from django.urls import path
from .views import ReportCreateView, AdminReportListView, AdminReportDetailView

urlpatterns = [
    path('reports/', ReportCreateView.as_view(), name='report-create'),
    path('admin/reports/', AdminReportListView.as_view(), name='admin-report-list'),
    path('admin/reports/<int:pk>/', AdminReportDetailView.as_view(), name='admin-report-detail'),
]
