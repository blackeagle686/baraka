from rest_framework import generics, permissions, filters, status
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import get_user_model
from django.db.models import Q
from .serializers import UserSerializer, AdminUserSerializer
from .permissions import IsAdminUserRole
from .throttles import AuthAnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from orders.models import Order
from shops.models import Shop
from core.models import Report

import random
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from .validators import validate_egyptian_phone, validate_strong_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import PhoneOTP
from .tasks import async_send_sms_otp

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer
    throttle_classes = [AuthAnonRateThrottle]

class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [AuthAnonRateThrottle]

class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [AuthAnonRateThrottle]

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user

# ==========================================
# Admin Dashboard API Views
# ==========================================

class AdminPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class AdminUserListView(generics.ListAPIView):
    """List all users with search & filter by role, approval, active status."""
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUserRole]
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = User.objects.all().order_by('-date_joined')
        search = self.request.query_params.get('search', '')
        role = self.request.query_params.get('role', '')
        approved = self.request.query_params.get('approved', '')
        active = self.request.query_params.get('active', '')

        if search:
            qs = qs.filter(Q(phone__icontains=search) | Q(name__icontains=search))
        if role:
            qs = qs.filter(role=role)
        if approved in ('true', 'false'):
            qs = qs.filter(is_approved=(approved == 'true'))
        if active in ('true', 'false'):
            qs = qs.filter(is_active=(active == 'true'))
        return qs

class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """Get or update a specific user (block/unblock, approve/reject)."""
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUserRole]
    queryset = User.objects.all()

class AdminStatsView(generics.GenericAPIView):
    """Return dashboard stats (total users, orders, etc.)."""
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        total_users = User.objects.count()
        total_customers = User.objects.filter(role='CUSTOMER').count()
        total_shop_owners = User.objects.filter(role='SHOP_OWNER').count()
        total_drivers = User.objects.filter(role='DRIVER').count()
        pending_approvals = User.objects.filter(is_approved=False).count()
        blocked_users = User.objects.filter(is_active=False).count()
        total_orders = Order.objects.count()
        total_shops = Shop.objects.count()
        total_reports = Report.objects.count()
        unresolved_reports = Report.objects.filter(is_resolved=False).count()

        return Response({
            'total_users': total_users,
            'total_customers': total_customers,
            'total_shop_owners': total_shop_owners,
            'total_drivers': total_drivers,
            'pending_approvals': pending_approvals,
            'blocked_users': blocked_users,
            'total_orders': total_orders,
            'total_shops': total_shops,
            'total_reports': total_reports,
            'unresolved_reports': unresolved_reports,
        })

# =========================================
# OTP Views for Phone Verification & Password Reset
# =========================================

class SendOTPView(APIView):
    """
    Generates and sends a 6-digit OTP verification code to an Egyptian subscriber.
    Optimized to run as a background task.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthAnonRateThrottle]

    def post(self, request):
        phone = request.data.get('phone')
        if not phone:
            return Response({"detail": "Phone number is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize and validate Egyptian format
        try:
            phone = validate_egyptian_phone(phone)
        except DjangoValidationError as e:
            return Response({"detail": e.message}, status=status.HTTP_400_BAD_REQUEST)

        # Generate random 6-digit code
        otp = f"{random.randint(100000, 999999)}"
        expires_at = timezone.now() + timedelta(minutes=5)

        # Update or create OTP record in DB
        PhoneOTP.objects.update_or_create(
            phone=phone,
            defaults={
                'otp': otp,
                'expires_at': expires_at,
                'attempts': 0,
                'is_verified': False
            }
        )

        # Offload delivery to Celery asynchronously!
        async_send_sms_otp.delay(phone, otp)

        return Response({
            "detail": "تم إرسال رمز التحقق لهاتفك بنجاح في الخلفية.",
            "phone": phone
        }, status=status.HTTP_200_OK)

class VerifyOTPView(APIView):
    """
    Verifies a 6-digit OTP with expiry checks and brute-force attempt limits.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthAnonRateThrottle]

    def post(self, request):
        phone = request.data.get('phone')
        otp = request.data.get('otp')

        if not phone or not otp:
            return Response({"detail": "Both phone and otp are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize phone
        try:
            phone = validate_egyptian_phone(phone)
        except DjangoValidationError as e:
            return Response({"detail": e.message}, status=status.HTTP_400_BAD_REQUEST)

        # Find matching PhoneOTP
        try:
            otp_record = PhoneOTP.objects.get(phone=phone)
        except PhoneOTP.DoesNotExist:
            return Response({"detail": "لم يتم طلب رمز تحقق لهذا الرقم."}, status=status.HTTP_400_BAD_REQUEST)

        # Brute-force protection: check attempts
        if otp_record.attempts >= 5:
            return Response({
                "detail": "عذراً، لقد تجاوزت الحد الأقصى للمحاولات (5 محاولات). يرجى طلب رمز جديد."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check expiry
        if timezone.now() > otp_record.expires_at:
            return Response({
                "detail": "رمز التحقق منتهي الصلاحية (صالح لمدة 5 دقائق فقط). يرجى طلب رمز جديد."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Increment attempts
        otp_record.attempts += 1
        otp_record.save()

        # Check code match
        if otp_record.otp != otp:
            remaining = 5 - otp_record.attempts
            return Response({
                "detail": f"رمز التحقق غير صحيح! المحاولات المتبقية: {remaining} محاولات."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Success: Mark verified
        otp_record.is_verified = True
        otp_record.save()

        # Update User verification status
        try:
            user = User.objects.get(phone=phone)
            user.is_phone_verified = True
            user.save()
        except User.DoesNotExist:
            # Standard flow: register first, then verify.
            pass

        return Response({
            "detail": "تم تفعيل وتأكيد رقم الهاتف بنجاح! حسابك نشط الآن.",
            "is_verified": True
        }, status=status.HTTP_200_OK)

class RequestPasswordResetOTPView(APIView):
    """
    Checks if user exists, generates OTP, and sends it for password reset.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthAnonRateThrottle]

    def post(self, request):
        phone = request.data.get('phone')
        if not phone:
            return Response({"detail": "رقم الهاتف مطلوب."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            phone = validate_egyptian_phone(phone)
        except DjangoValidationError as e:
            return Response({"detail": e.message}, status=status.HTTP_400_BAD_REQUEST)

        # Check if user exists
        if not User.objects.filter(phone=phone).exists():
            return Response({"detail": "هذا الرقم غير مسجل لدينا."}, status=status.HTTP_404_NOT_FOUND)

        otp = f"{random.randint(100000, 999999)}"
        expires_at = timezone.now() + timedelta(minutes=5)

        PhoneOTP.objects.update_or_create(
            phone=phone,
            defaults={'otp': otp, 'expires_at': expires_at, 'attempts': 0, 'is_verified': False}
        )

        async_send_sms_otp.delay(phone, otp)

        return Response({
            "detail": "تم إرسال رمز التحقق بنجاح إلى هاتفك.",
            "phone": phone
        }, status=status.HTTP_200_OK)

class ResetPasswordWithOTPView(APIView):
    """
    Verifies OTP and resets the user's password.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthAnonRateThrottle]

    def post(self, request):
        
        
        phone = request.data.get('phone')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')

        if not all([phone, otp, new_password]):
            return Response({"detail": "رقم الهاتف، الرمز، وكلمة المرور الجديدة مطلوبة."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            phone = validate_egyptian_phone(phone)
        except DjangoValidationError as e:
            return Response({"detail": e.message}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_password = validate_strong_password(new_password)
        except DjangoValidationError as e:
            return Response({"detail": e.message}, status=status.HTTP_400_BAD_REQUEST)

        # OTP Verification Logic (similar to VerifyOTPView)
        try:
            otp_record = PhoneOTP.objects.get(phone=phone)
        except PhoneOTP.DoesNotExist:
            return Response({"detail": "لم يتم طلب رمز تحقق لهذا الرقم."}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.attempts >= 5:
            return Response({"detail": "تجاوزت الحد الأقصى للمحاولات. اطلب رمز جديد."}, status=status.HTTP_400_BAD_REQUEST)

        if timezone.now() > otp_record.expires_at:
            return Response({"detail": "رمز التحقق منتهي الصلاحية."}, status=status.HTTP_400_BAD_REQUEST)

        otp_record.attempts += 1
        otp_record.save()

        if otp_record.otp != otp:
            return Response({"detail": f"رمز التحقق غير صحيح! المتبقي {5 - otp_record.attempts} محاولات."}, status=status.HTTP_400_BAD_REQUEST)

        # Success - change password
        try:
            user = User.objects.get(phone=phone)
            user.set_password(new_password)
            user.save()
            
            # Clear OTP to prevent reuse
            otp_record.delete()
            
            return Response({"detail": "تم تغيير كلمة المرور بنجاح."}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"detail": "المستخدم غير موجود."}, status=status.HTTP_404_NOT_FOUND)

