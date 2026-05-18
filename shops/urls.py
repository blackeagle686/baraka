from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShopViewSet, CategoryViewSet, ProductViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r'shops', ShopViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
