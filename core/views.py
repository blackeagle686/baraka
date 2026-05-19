from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from .models import Report
from .serializers import ReportSerializer
from users.permissions import IsAdminUserRole


class ReportPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100


class ReportCreateView(generics.CreateAPIView):
    """Any authenticated user can submit a report."""
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]


class AdminReportListView(generics.ListAPIView):
    """Admin can list all reports with search & filter."""
    serializer_class = ReportSerializer
    permission_classes = [IsAdminUserRole]
    pagination_class = ReportPagination

    def get_queryset(self):
        qs = Report.objects.all()
        search = self.request.query_params.get('search', '')
        resolved = self.request.query_params.get('resolved', '')

        if search:
            qs = qs.filter(Q(subject__icontains=search) | Q(description__icontains=search) | Q(user__phone__icontains=search))
        if resolved in ('true', 'false'):
            qs = qs.filter(is_resolved=(resolved == 'true'))
        return qs


class AdminReportDetailView(generics.RetrieveUpdateAPIView):
    """Admin can view/resolve a report."""
    serializer_class = ReportSerializer
    permission_classes = [IsAdminUserRole]
    queryset = Report.objects.all()

    def perform_update(self, serializer):
        report = serializer.save()
        if report.is_resolved and report.subject.startswith("نزاع على الطلب #"):
            try:
                parts = report.subject.split('#')
                if len(parts) > 1:
                    order_id = int(parts[1].strip())
                    from orders.models import Order
                    order = Order.objects.get(id=order_id)
                    order.dispute_status = 'RESOLVED'
                    order.save()
            except Exception as e:
                pass

