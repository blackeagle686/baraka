from rest_framework import generics, permissions, filters, status
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import get_user_model
from django.db.models import Q
from .serializers import UserSerializer, AdminUserSerializer
from .permissions import IsAdminUserRole
from .throttles import AuthAnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

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
        from orders.models import Order
        from shops.models import Shop
        from core.models import Report

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
