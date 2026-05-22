from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

from .models import Clinic, MedicalService


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
