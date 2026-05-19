from django.urls import path
from .views import (
    RegisterView, ThrottledTokenObtainPairView, ThrottledTokenRefreshView,
    ProfileView, AdminUserListView, AdminUserDetailView, AdminStatsView,
    SendOTPView, VerifyOTPView,
    RequestPasswordResetOTPView, ResetPasswordWithOTPView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('send-otp/', SendOTPView.as_view(), name='send_otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
    path('password-reset/request/', RequestPasswordResetOTPView.as_view(), name='password_reset_request'),
    path('password-reset/confirm/', ResetPasswordWithOTPView.as_view(), name='password_reset_confirm'),

    # Admin endpoints
    path('admin/users/', AdminUserListView.as_view(), name='admin-user-list'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
]
