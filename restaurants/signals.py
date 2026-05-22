from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import Restaurant, MenuItem, MenuCategory


@receiver([post_save, post_delete], sender=Restaurant)
def invalidate_restaurants_cache(sender, instance, **kwargs):
    try:
        current_version = cache.get("restaurants_list_version", 1)
        cache.set("restaurants_list_version", current_version + 1, timeout=None)
    except Exception:
        pass


@receiver([post_save, post_delete], sender=MenuItem)
def invalidate_menu_items_cache(sender, instance, **kwargs):
    try:
        current_version = cache.get("menu_items_list_version", 1)
        cache.set("menu_items_list_version", current_version + 1, timeout=None)
    except Exception:
        pass


@receiver([post_save, post_delete], sender=MenuCategory)
def invalidate_menu_categories_cache(sender, instance, **kwargs):
    try:
        current_version = cache.get("menu_categories_version", 1)
        cache.set("menu_categories_version", current_version + 1, timeout=None)
    except Exception:
        pass
