from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.core.cache import cache

import hashlib
from orders.tasks import recalculate_shop_rating_stats

from .models import Shop, Category, Product, Notification
from orders.models import Order, OrderStatus

from .serializers import ShopRating, ShopSerializer, ShopRatingSerializer, ShopCreateSerializer, CategorySerializer, ProductSerializer, NotificationSerializer
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

    def list(self, request, *args, **kwargs):
        page = request.query_params.get('page', '1')
        search = request.query_params.get('search', '')
        page_size = request.query_params.get('page_size', '')
        
        hasher = hashlib.md5()
        hasher.update(f"{page}::{search}::{page_size}".encode('utf-8'))
        
        version = cache.get("shops_list_version", 1)
        cache_key = f"shops_list_v{version}_{hasher.hexdigest()}"
        
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)
            
        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=300)
        return response

    def get_serializer_class(self):
        if self.action == 'create':
            return ShopCreateSerializer
        return ShopSerializer

    def create(self, request, *args, **kwargs):
        if request.user.role != 'SHOP_OWNER' and not request.user.is_staff:
            return Response({"detail": "Only users with the SHOP_OWNER role can create a shop."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        Notification.objects.create(
            user=serializer.instance.owner,
            shop=serializer.instance,
            title='تم إنشاء متجرك بنجاح',
            message=(
                f"تم إنشاء متجر '{serializer.instance.name}' بنجاح. "
                f"يمكنك الآن إضافة منتجات وإدارة الطلبات من لوحة التحكم."
            ),
            notification_type='shop_created'
        )

        full_serializer = ShopSerializer(serializer.instance, context=self.get_serializer_context())
        return Response(full_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

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

        # Check if the user has a completed order from this shop (including multi-shop orders)
        has_bought = Order.objects.filter(customer=user, items__product__shop=shop, status=OrderStatus.DELIVERED).exists()
        if not has_bought:
            return Response(
                {"detail": "Only customers who have successfully bought from this shop can rate it."},
                status=status.HTTP_403_FORBIDDEN
            )

        
        # Create or update rating
        rating_obj, created = ShopRating.objects.update_or_create(
            shop=shop,
            customer=user,
            defaults={'rating': rating_val, 'review': review_val}
        )

        Notification.objects.create(
            user=shop.owner,
            shop=shop,
            title='تم تقييم متجرك',
            message=(
                f"حصل متجرك '{shop.name}' على تقييم جديد من عميل. "
                f"التقييم: {rating_val} نجوم."
            ),
            notification_type='shop_rated'
        )
        
        # Trigger background stats recalculation
        recalculate_shop_rating_stats.delay(shop.id)
        
        serializer = ShopRatingSerializer(rating_obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def rating_status(self, request, pk=None):
        shop = self.get_object()
        user = request.user
        has_bought = Order.objects.filter(customer=user, items__product__shop=shop, status=OrderStatus.DELIVERED).exists()
        
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

    def list(self, request, *args, **kwargs):
        version = cache.get("categories_version", 1)
        cache_key = f"categories_v{version}"
        
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)
            
        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=900)
        return response

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsApprovedOrReadOnly, IsOwnerOrReadOnly]

    def list(self, request, *args, **kwargs):
        shop_id = request.query_params.get('shop_id', '')
        search = request.query_params.get('search', '')
        page = request.query_params.get('page', '1')
        
        hasher = hashlib.md5()
        hasher.update(f"{shop_id}::{search}::{page}".encode('utf-8'))
        
        version = cache.get("products_list_version", 1)
        cache_key = f"products_list_v{version}_{hasher.hexdigest()}"
        
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)
            
        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=300)
        return response

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
