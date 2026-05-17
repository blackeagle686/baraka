from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShopViewSet, CategoryViewSet, ProductViewSet

router = DefaultRouter()
router.register(r'shops', ShopViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
