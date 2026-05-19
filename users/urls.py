from django.urls import path
from .views import (
    RegisterView, ThrottledTokenObtainPairView, ThrottledTokenRefreshView,
    ProfileView, AdminUserListView, AdminUserDetailView, AdminStatsView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),

    # Admin endpoints
    path('admin/users/', AdminUserListView.as_view(), name='admin-user-list'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
]
