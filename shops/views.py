from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from .models import Shop, Category, Product, Notification
from .serializers import ShopSerializer, CategorySerializer, ProductSerializer, NotificationSerializer
from .permissions import IsOwnerOrReadOnly
from users.permissions import IsApprovedOrReadOnly

class ShopPagination(PageNumberPagination):
    page_size = 6
    page_size_query_param = 'page_size'
    max_page_size = 100

class ShopViewSet(viewsets.ModelViewSet):
    queryset = Shop.objects.all()
    serializer_class = ShopSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsApprovedOrReadOnly, IsOwnerOrReadOnly]
    pagination_class = ShopPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description', 'address']

    def create(self, request, *args, **kwargs):
        if request.user.role != 'SHOP_OWNER' and not request.user.is_staff:
            return Response({"detail": "Only users with the SHOP_OWNER role can create a shop."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_shop(self, request):
        shop = Shop.objects.filter(owner=request.user).first()
        if shop:
            serializer = self.get_serializer(shop)
            return Response(serializer.data)
        return Response({'detail': 'No shop found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def rate(self, request, pk=None):
        shop = self.get_object()
        user = request.user
        rating_val = request.data.get('rating')
        review_val = request.data.get('review', '')

        # Check if rating value is correct
        try:
            rating_val = int(rating_val)
            if rating_val < 1 or rating_val > 5:
                raise ValueError
        except (TypeError, ValueError):
            return Response({"detail": "Rating must be an integer between 1 and 5."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if the user has a completed order from this shop
        from orders.models import Order, OrderStatus
        has_bought = Order.objects.filter(customer=user, shop=shop, status=OrderStatus.DELIVERED).exists()
        if not has_bought:
            return Response(
                {"detail": "Only customers who have successfully bought from this shop can rate it."},
                status=status.HTTP_403_FORBIDDEN
            )

        from .models import ShopRating
        from .serializers import ShopRatingSerializer
        
        # Create or update rating
        rating_obj, created = ShopRating.objects.update_or_create(
            shop=shop,
            customer=user,
            defaults={'rating': rating_val, 'review': review_val}
        )
        
        serializer = ShopRatingSerializer(rating_obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def rating_status(self, request, pk=None):
        shop = self.get_object()
        user = request.user
        from orders.models import Order, OrderStatus
        has_bought = Order.objects.filter(customer=user, shop=shop, status=OrderStatus.DELIVERED).exists()
        
        from .models import ShopRating
        existing_rating = ShopRating.objects.filter(shop=shop, customer=user).first()
        existing_data = {
            'rating': existing_rating.rating,
            'review': existing_rating.review
        } if existing_rating else None

        return Response({
            'can_rate': has_bought,
            'existing_rating': existing_data
        })

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsApprovedOrReadOnly, IsOwnerOrReadOnly]

    def create(self, request, *args, **kwargs):
        if request.user.role != 'SHOP_OWNER' and not request.user.is_staff:
            return Response({"detail": "Only shop owners can add products."}, status=status.HTTP_403_FORBIDDEN)
        shop = Shop.objects.filter(owner=request.user).first()
        if not shop:
            return Response({"detail": "You must create a shop first before adding products."}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        shop = Shop.objects.filter(owner=self.request.user).first()
        serializer.save(shop=shop)

    def get_queryset(self):
        queryset = Product.objects.all()
        shop_id = self.request.query_params.get('shop_id', None)
        if shop_id is not None:
            queryset = queryset.filter(shop_id=shop_id)
        return queryset

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'all marked as read'})
