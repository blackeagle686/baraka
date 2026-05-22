from django.db import models
from django.conf import settings
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache


class Clinic(models.Model):
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='clinics'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    specialization = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    image = models.ImageField(upload_to='clinics/', blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_open = models.BooleanField(default=True)
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class MedicalService(models.Model):
    clinic = models.ForeignKey(
        Clinic, on_delete=models.CASCADE,
        related_name='services'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_minutes = models.PositiveIntegerField(default=30)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.clinic.name}"


class TimeSlot(models.Model):
    clinic = models.ForeignKey(
        Clinic, on_delete=models.CASCADE,
        related_name='time_slots'
    )
    service = models.ForeignKey(
        MedicalService, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='time_slots'
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)
    is_auto_generated = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('clinic', 'date', 'start_time')

    def __str__(self):
        return f"{self.clinic.name} - {self.date} {self.start_time}"


class AppointmentStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    CONFIRMED = 'CONFIRMED', 'Confirmed'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class Appointment(models.Model):
    clinic = models.ForeignKey(
        Clinic, on_delete=models.CASCADE,
        related_name='appointments'
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='appointments'
    )
    service = models.ForeignKey(
        MedicalService, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='appointments'
    )
    time_slot = models.ForeignKey(
        TimeSlot, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='appointments'
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(
        max_length=20,
        choices=AppointmentStatus.choices,
        default=AppointmentStatus.PENDING
    )
    notes = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.patient.phone} - {self.clinic.name} ({self.date})"


class ClinicRating(models.Model):
    clinic = models.ForeignKey(
        Clinic, on_delete=models.CASCADE,
        related_name='ratings'
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='clinic_ratings'
    )
    rating = models.PositiveSmallIntegerField()
    review = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('clinic', 'patient')

    def __str__(self):
        return f"{self.patient.phone} rated {self.clinic.name} - {self.rating}"


class ClinicNotification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='clinic_notifications'
    )
    clinic = models.ForeignKey(
        Clinic, on_delete=models.CASCADE,
        null=True, blank=True, related_name='clinic_notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, default='info')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.phone} - {self.title}"


@receiver([post_save, post_delete], sender=Clinic)
def invalidate_clinics_cache(sender, instance, **kwargs):
    try:
        current_version = cache.get("clinics_list_version", 1)
        cache.set("clinics_list_version", current_version + 1, timeout=None)
    except Exception:
        pass


@receiver([post_save, post_delete], sender=MedicalService)
def invalidate_services_cache(sender, instance, **kwargs):
    try:
        current_version = cache.get("services_list_version", 1)
        cache.set("services_list_version", current_version + 1, timeout=None)
    except Exception:
        pass
