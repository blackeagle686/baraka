from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, AdminOrderListView

router = DefaultRouter()
router.register(r'orders', OrderViewSet, basename='order')

urlpatterns = [
    path('', include(router.urls)),
    path('admin/orders/', AdminOrderListView.as_view(), name='admin-order-list'),
]

