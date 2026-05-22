from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ClinicViewSet, MedicalServiceViewSet, TimeSlotViewSet,
    AppointmentViewSet, ClinicNotificationViewSet
)

router = DefaultRouter()
router.register(r'clinics', ClinicViewSet)
router.register(r'services', MedicalServiceViewSet)
router.register(r'time-slots', TimeSlotViewSet)
router.register(r'appointments', AppointmentViewSet)
router.register(r'clinic-notifications', ClinicNotificationViewSet, basename='clinic-notification')

urlpatterns = [
    path('', include(router.urls)),
]
