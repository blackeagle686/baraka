from django.contrib import admin
from .models import Clinic, MedicalService, TimeSlot, Appointment, ClinicRating, ClinicNotification

admin.site.register(Clinic)
admin.site.register(MedicalService)
admin.site.register(TimeSlot)
admin.site.register(Appointment)
admin.site.register(ClinicRating)
admin.site.register(ClinicNotification)
