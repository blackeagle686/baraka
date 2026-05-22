from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.core.cache import cache
from django.shortcuts import get_object_or_404

import hashlib
from datetime import datetime, date

from .models import Clinic, MedicalService, TimeSlot, Appointment, ClinicNotification, AppointmentStatus
from .serializers import (
    ClinicSerializer, ClinicCreateSerializer, MedicalServiceSerializer,
    TimeSlotSerializer, AppointmentSerializer, AppointmentCreateSerializer,
    AppointmentUpdateStatusSerializer, ClinicRatingSerializer
)
from .permissions import IsDoctorOrReadOnly, IsPatientOrDoctor
from .services import generate_slots_for_date_range

from users.permissions import IsApprovedOrReadOnly


class ClinicPagination(PageNumberPagination):
    page_size = 6
    page_size_query_param = 'page_size'
    max_page_size = 100


class ClinicViewSet(viewsets.ModelViewSet):
    queryset = Clinic.objects.all()
    serializer_class = ClinicSerializer
    permission_classes = [
        permissions.IsAuthenticatedOrReadOnly,
        IsApprovedOrReadOnly,
        IsDoctorOrReadOnly
    ]
    pagination_class = ClinicPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description', 'specialization', 'address']

    def list(self, request, *args, **kwargs):
        page = request.query_params.get('page', '1')
        search = request.query_params.get('search', '')
        specialization = request.query_params.get('specialization', '')
        page_size = request.query_params.get('page_size', '')

        hasher = hashlib.md5()
        hasher.update(f"{page}::{search}::{specialization}::{page_size}".encode('utf-8'))

        version = cache.get("clinics_list_version", 1)
        cache_key = f"clinics_list_v{version}_{hasher.hexdigest()}"

        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        queryset = self.filter_queryset(self.get_queryset())
        if specialization:
            queryset = queryset.filter(specialization__icontains=specialization)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            result = self.get_paginated_response(serializer.data)
            cache.set(cache_key, result.data, timeout=300)
            return result

        serializer = self.get_serializer(queryset, many=True)
        cache.set(cache_key, serializer.data, timeout=300)
        return Response(serializer.data)

    def get_serializer_class(self):
        if self.action == 'create':
            return ClinicCreateSerializer
        return ClinicSerializer

    def create(self, request, *args, **kwargs):
        if request.user.role != 'DOCTOR' and not request.user.is_staff:
            return Response(
                {"detail": "فقط الأطباء يمكنهم إنشاء عيادة."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        ClinicNotification.objects.create(
            user=serializer.instance.doctor,
            clinic=serializer.instance,
            title='تم إنشاء عيادتك بنجاح',
            message=(
                f"تم إنشاء عيادة '{serializer.instance.name}' بنجاح. "
                f"يمكنك الآن إضافة الخدمات وإدارة المواعيد من لوحة التحكم."
            ),
            notification_type='clinic_created'
        )

        full_serializer = ClinicSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        return Response(
            full_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )

    def perform_create(self, serializer):
        serializer.save(doctor=self.request.user)

    @action(detail=False, methods=['get'],
            permission_classes=[permissions.IsAuthenticated])
    def my_clinic(self, request):
        clinic = Clinic.objects.filter(doctor=request.user).first()
        if clinic:
            serializer = self.get_serializer(clinic)
            return Response(serializer.data)
        return Response(
            {'detail': 'لا توجد عيادة.'},
            status=status.HTTP_404_NOT_FOUND
        )

    @action(detail=True, methods=['post'],
            permission_classes=[permissions.IsAuthenticated])
    def toggle_status(self, request, pk=None):
        clinic = self.get_object()
        if clinic.doctor != request.user:
            return Response(
                {"detail": "ليس لديك صلاحية."},
                status=status.HTTP_403_FORBIDDEN
            )
        clinic.is_open = not clinic.is_open
        clinic.save()
        return Response({'is_open': clinic.is_open})

    @action(detail=True, methods=['post'],
            permission_classes=[permissions.IsAuthenticated])
    def generate_slots(self, request, pk=None):
        clinic = self.get_object()
        if clinic.doctor != request.user:
            return Response(
                {"detail": "ليس لديك صلاحية."},
                status=status.HTTP_403_FORBIDDEN
            )

        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')

        if not start_date_str or not end_date_str:
            return Response(
                {"detail": "يرجى تحديد تاريخ البداية والنهاية."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {"detail": "صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        generate_slots_for_date_range(clinic, start_date, end_date)

        slots = TimeSlot.objects.filter(
            clinic=clinic,
            date__gte=start_date,
            date__lte=end_date,
            is_available=True
        ).count()

        return Response({
            'message': f'تم إنشاء {slots} موعد متاح.',
            'slots_count': slots
        })

    @action(detail=True, methods=['get'])
    def available_slots(self, request, pk=None):
        clinic = self.get_object()
        date_str = request.query_params.get('date')
        service_id = request.query_params.get('service_id')

        if not date_str:
            return Response(
                {"detail": "يرجى تحديد التاريخ."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {"detail": "صيغة التاريخ غير صحيحة."},
                status=status.HTTP_400_BAD_REQUEST
            )

        slots = TimeSlot.objects.filter(
            clinic=clinic,
            date=target_date,
            is_available=True
        )

        if service_id:
            slots = slots.filter(service_id=service_id)

        serializer = TimeSlotSerializer(slots, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def available_dates(self, request, pk=None):
        clinic = self.get_object()
        service_id = request.query_params.get('service_id')
        from datetime import date as date_type

        qs = TimeSlot.objects.filter(
            clinic=clinic,
            date__gte=date_type.today(),
            is_available=True
        ).values('date').annotate(
            slot_count=models.Count('id')
        ).order_by('date')[:31]

        if service_id:
            qs = TimeSlot.objects.filter(
                clinic=clinic,
                service_id=service_id,
                date__gte=date_type.today(),
                is_available=True
            ).values('date').annotate(
                slot_count=models.Count('id')
            ).order_by('date')[:31]

        return Response([
            {'date': d['date'].isoformat(), 'slot_count': d['slot_count']}
            for d in qs
        ])

    @action(detail=True, methods=['post'],
            permission_classes=[permissions.IsAuthenticated])
    def rate(self, request, pk=None):
        clinic = self.get_object()
        user = request.user
        rating_val = request.data.get('rating')
        review_val = request.data.get('review', '')

        try:
            rating_val = int(rating_val)
            if rating_val < 1 or rating_val > 5:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {"detail": "التقييم يجب أن يكون بين 1 و 5."},
                status=status.HTTP_400_BAD_REQUEST
            )

        has_appointment = Appointment.objects.filter(
            clinic=clinic,
            patient=user,
            status=AppointmentStatus.COMPLETED
        ).exists()

        if not has_appointment:
            return Response(
                {"detail": "فقط المرضى الذين حجزوا يمكنهم التقييم."},
                status=status.HTTP_403_FORBIDDEN
            )

        from .models import ClinicRating
        rating_obj, created = ClinicRating.objects.update_or_create(
            clinic=clinic,
            patient=user,
            defaults={'rating': rating_val, 'review': review_val}
        )

        ClinicNotification.objects.create(
            user=clinic.doctor,
            clinic=clinic,
            title='تم تقييم عيادتك',
            message=(
                f"حصلت عيادتك '{clinic.name}' على تقييم جديد. "
                f"التقييم: {rating_val} نجوم."
            ),
            notification_type='clinic_rated'
        )

        serializer = ClinicRatingSerializer(rating_obj)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=True, methods=['get'],
            permission_classes=[permissions.IsAuthenticated])
    def rating_status(self, request, pk=None):
        clinic = self.get_object()
        user = request.user

        has_appointment = Appointment.objects.filter(
            clinic=clinic,
            patient=user,
            status=AppointmentStatus.COMPLETED
        ).exists()

        from .models import ClinicRating
        existing_rating = ClinicRating.objects.filter(
            clinic=clinic, patient=user
        ).first()
        existing_data = {
            'rating': existing_rating.rating,
            'review': existing_rating.review
        } if existing_rating else None

        return Response({
            'can_rate': has_appointment,
            'existing_rating': existing_data
        })


class MedicalServiceViewSet(viewsets.ModelViewSet):
    queryset = MedicalService.objects.all()
    serializer_class = MedicalServiceSerializer
    permission_classes = [
        permissions.IsAuthenticatedOrReadOnly,
        IsDoctorOrReadOnly
    ]

    def list(self, request, *args, **kwargs):
        clinic_id = request.query_params.get('clinic_id', '')

        hasher = hashlib.md5()
        hasher.update(f"{clinic_id}".encode('utf-8'))

        version = cache.get("services_list_version", 1)
        cache_key = f"services_list_v{version}_{hasher.hexdigest()}"

        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=300)
        return response

    def create(self, request, *args, **kwargs):
        if request.user.role != 'DOCTOR' and not request.user.is_staff:
            return Response(
                {"detail": "فقط الأطباء يمكنهم إضافة خدمات."},
                status=status.HTTP_403_FORBIDDEN
            )
        clinic = Clinic.objects.filter(doctor=request.user).first()
        if not clinic:
            return Response(
                {"detail": "يجب إنشاء عيادة أولاً."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        clinic = Clinic.objects.filter(doctor=self.request.user).first()
        serializer.save(clinic=clinic)

    def get_queryset(self):
        queryset = MedicalService.objects.all()
        clinic_id = self.request.query_params.get('clinic_id', None)
        if clinic_id is not None:
            queryset = queryset.filter(clinic_id=clinic_id)
        return queryset


class TimeSlotViewSet(viewsets.ModelViewSet):
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer
    permission_classes = [
        permissions.IsAuthenticatedOrReadOnly,
        IsDoctorOrReadOnly
    ]

    def create(self, request, *args, **kwargs):
        if request.user.role != 'DOCTOR' and not request.user.is_staff:
            return Response(
                {"detail": "فقط الأطباء يمكنهم إضافة مواعيد."},
                status=status.HTTP_403_FORBIDDEN
            )
        clinic = Clinic.objects.filter(doctor=request.user).first()
        if not clinic:
            return Response(
                {"detail": "يجب إنشاء عيادة أولاً."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        clinic = Clinic.objects.filter(doctor=self.request.user).first()
        serializer.save(clinic=clinic)

    def get_queryset(self):
        queryset = TimeSlot.objects.all()
        clinic_id = self.request.query_params.get('clinic_id')
        date_str = self.request.query_params.get('date')
        if clinic_id:
            queryset = queryset.filter(clinic_id=clinic_id)
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                queryset = queryset.filter(date=target_date)
            except ValueError:
                pass
        return queryset


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsPatientOrDoctor]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'DOCTOR':
            clinic = Clinic.objects.filter(doctor=user).first()
            if clinic:
                return Appointment.objects.filter(clinic=clinic)
            return Appointment.objects.none()
        return Appointment.objects.filter(patient=user)

    def create(self, request, *args, **kwargs):
        serializer = AppointmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        clinic = serializer.validated_data['clinic']
        if not clinic.is_open:
            return Response(
                {"detail": "العيادة مغلقة حالياً."},
                status=status.HTTP_400_BAD_REQUEST
            )

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        ClinicNotification.objects.create(
            user=clinic.doctor,
            clinic=clinic,
            title='موعد جديد في عيادتك',
            message=(
                f"قام {request.user.name or request.user.phone} بحجز موعد "
                f"في {serializer.validated_data['date']} "
                f"الساعة {serializer.validated_data['start_time']}."
            ),
            notification_type='new_appointment'
        )

        full_serializer = AppointmentSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        return Response(
            full_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user)
        time_slot = serializer.validated_data.get('time_slot')
        if time_slot:
            time_slot.is_available = False
            time_slot.save()

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        appointment = self.get_object()
        clinic = appointment.clinic

        if clinic.doctor != request.user:
            return Response(
                {"detail": "ليس لديك صلاحية."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = AppointmentUpdateStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        old_status = appointment.status
        appointment.status = new_status
        appointment.save()

        if new_status == 'CANCELLED' and appointment.time_slot:
            appointment.time_slot.is_available = True
            appointment.time_slot.save()

        if new_status == 'CONFIRMED':
            ClinicNotification.objects.create(
                user=appointment.patient,
                clinic=clinic,
                title='تم تأكيد موعدك',
                message=(
                    f"تم تأكيد موعدك في عيادة '{clinic.name}' "
                    f"بتاريخ {appointment.date} الساعة {appointment.start_time}."
                ),
                notification_type='appointment_confirmed'
            )
        elif new_status == 'CANCELLED':
            ClinicNotification.objects.create(
                user=appointment.patient,
                clinic=clinic,
                title='تم إلغاء الموعد',
                message=(
                    f"تم إلغاء موعدك في عيادة '{clinic.name}' "
                    f"بتاريخ {appointment.date}."
                ),
                notification_type='appointment_cancelled'
            )

        reserializer = AppointmentSerializer(appointment)
        return Response(reserializer.data)

    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "استخدم update_status لتحديث الموعد."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def partial_update(self, request, *args, **kwargs):
        return Response(
            {"detail": "استخدم update_status لتحديث الموعد."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )


class ClinicNotificationViewSet(viewsets.ModelViewSet):
    queryset = ClinicNotification.objects.none()
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ClinicNotification.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        notifications = self.get_queryset()
        data = [
            {
                'id': n.id,
                'clinic': n.clinic.id if n.clinic else None,
                'title': n.title,
                'message': n.message,
                'notification_type': n.notification_type,
                'is_read': n.is_read,
                'created_at': n.created_at.isoformat()
            }
            for n in notifications
        ]
        return Response(data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'all marked as read'})
