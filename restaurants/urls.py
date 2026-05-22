from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RestaurantViewSet, MenuCategoryViewSet, MenuItemViewSet, RestaurantNotificationViewSet

router = DefaultRouter()
router.register(r'restaurants', RestaurantViewSet)
router.register(r'menu-categories', MenuCategoryViewSet)
router.register(r'menu-items', MenuItemViewSet)
router.register(r'restaurant-notifications', RestaurantNotificationViewSet, basename='restaurant-notification')

urlpatterns = [
    path('', include(router.urls)),
]
