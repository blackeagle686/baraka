from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, AdminOrderListView
from .chatbot import ChatbotView

router = DefaultRouter()
router.register(r'orders', OrderViewSet, basename='order')

urlpatterns = [
    path('', include(router.urls)),
    path('admin/orders/', AdminOrderListView.as_view(), name='admin-order-list'),
    path('chatbot/chat/', ChatbotView.as_view(), name='chatbot-chat'),
]

