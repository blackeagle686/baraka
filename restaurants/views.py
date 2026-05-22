from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.core.cache import cache

import hashlib
from orders.tasks import recalculate_shop_rating_stats

from .models import Restaurant, MenuCategory, MenuItem, RestaurantRating, RestaurantNotification
from .serializers import (
    Restaurant, RestaurantSerializer, RestaurantRatingSerializer,
    RestaurantCreateSerializer, MenuCategorySerializer, MenuItemSerializer,
    RestaurantNotificationSerializer
)
from .permissions import IsRestaurantOwnerOrReadOnly
from users.permissions import IsApprovedOrReadOnly


class RestaurantPagination(PageNumberPagination):
    page_size = 6
    page_size_query_param = 'page_size'
    max_page_size = 100


class RestaurantViewSet(viewsets.ModelViewSet):
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsApprovedOrReadOnly, IsRestaurantOwnerOrReadOnly]
    pagination_class = RestaurantPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description', 'address']

    def list(self, request, *args, **kwargs):
        page = request.query_params.get('page', '1')
        search = request.query_params.get('search', '')
        page_size = request.query_params.get('page_size', '')

        hasher = hashlib.md5()
        hasher.update(f"{page}::{search}::{page_size}".encode('utf-8'))

        version = cache.get("restaurants_list_version", 1)
        cache_key = f"restaurants_list_v{version}_{hasher.hexdigest()}"

        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=300)
        return response

    def get_serializer_class(self):
        if self.action == 'create':
            return RestaurantCreateSerializer
        return RestaurantSerializer

    def create(self, request, *args, **kwargs):
        if request.user.role != 'RESTAURANT_OWNER' and not request.user.is_staff:
            return Response({"detail": "Only users with the RESTAURANT_OWNER role can create a restaurant."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        RestaurantNotification.objects.create(
            user=serializer.instance.owner,
            restaurant=serializer.instance,
            title='تم إنشاء مطعمك بنجاح',
            message=(
                f"تم إنشاء مطعم '{serializer.instance.name}' بنجاح. "
                f"يمكنك الآن إضافة قائمة طعام وإدارة الطلبات من لوحة التحكم."
            ),
            notification_type='restaurant_created'
        )

        full_serializer = RestaurantSerializer(serializer.instance, context=self.get_serializer_context())
        return Response(full_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_restaurant(self, request):
        restaurant = Restaurant.objects.filter(owner=request.user).first()
        if restaurant:
            serializer = self.get_serializer(restaurant)
            return Response(serializer.data)
        return Response({'detail': 'No restaurant found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def rate(self, request, pk=None):
        restaurant = self.get_object()
        user = request.user
        rating_val = request.data.get('rating')
        review_val = request.data.get('review', '')

        try:
            rating_val = int(rating_val)
            if rating_val < 1 or rating_val > 5:
                raise ValueError
        except (TypeError, ValueError):
            return Response({"detail": "Rating must be an integer between 1 and 5."}, status=status.HTTP_400_BAD_REQUEST)

        from orders.models import Order, OrderStatus
        has_bought = Order.objects.filter(
            customer=user,
            items__menu_item__restaurant=restaurant,
            status=OrderStatus.DELIVERED
        ).exists()
        if not has_bought:
            return Response(
                {"detail": "Only customers who have successfully ordered from this restaurant can rate it."},
                status=status.HTTP_403_FORBIDDEN
            )

        rating_obj, created = RestaurantRating.objects.update_or_create(
            restaurant=restaurant,
            customer=user,
            defaults={'rating': rating_val, 'review': review_val}
        )

        RestaurantNotification.objects.create(
            user=restaurant.owner,
            restaurant=restaurant,
            title='تم تقييم مطعمك',
            message=(
                f"حصل مطعمك '{restaurant.name}' على تقييم جديد من عميل. "
                f"التقييم: {rating_val} نجوم."
            ),
            notification_type='restaurant_rated'
        )

        recalculate_shop_rating_stats.delay(restaurant.id)

        serializer = RestaurantRatingSerializer(rating_obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def rating_status(self, request, pk=None):
        restaurant = self.get_object()
        user = request.user

        from orders.models import Order, OrderStatus
        has_bought = Order.objects.filter(
            customer=user,
            items__menu_item__restaurant=restaurant,
            status=OrderStatus.DELIVERED
        ).exists()

        existing_rating = RestaurantRating.objects.filter(restaurant=restaurant, customer=user).first()
        existing_data = {
            'rating': existing_rating.rating,
            'review': existing_rating.review
        } if existing_rating else None

        return Response({
            'can_rate': has_bought,
            'existing_rating': existing_data
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsApprovedOrReadOnly])
    def toggle_status(self, request, pk=None):
        restaurant = self.get_object()
        if restaurant.owner != request.user and not request.user.is_staff:
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        restaurant.is_open = not restaurant.is_open
        restaurant.save()
        return Response(self.get_serializer(restaurant).data)


class MenuCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MenuCategory.objects.all()
    serializer_class = MenuCategorySerializer
    permission_classes = [permissions.AllowAny]

    def list(self, request, *args, **kwargs):
        version = cache.get("menu_categories_version", 1)
        cache_key = f"menu_categories_v{version}"

        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=900)
        return response


class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsApprovedOrReadOnly, IsRestaurantOwnerOrReadOnly]

    def list(self, request, *args, **kwargs):
        restaurant_id = request.query_params.get('restaurant_id', '')
        search = request.query_params.get('search', '')
        page = request.query_params.get('page', '1')

        hasher = hashlib.md5()
        hasher.update(f"{restaurant_id}::{search}::{page}".encode('utf-8'))

        version = cache.get("menu_items_list_version", 1)
        cache_key = f"menu_items_list_v{version}_{hasher.hexdigest()}"

        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=300)
        return response

    def create(self, request, *args, **kwargs):
        if request.user.role != 'RESTAURANT_OWNER' and not request.user.is_staff:
            return Response({"detail": "Only restaurant owners can add menu items."}, status=status.HTTP_403_FORBIDDEN)
        restaurant = Restaurant.objects.filter(owner=request.user).first()
        if not restaurant:
            return Response({"detail": "You must create a restaurant first before adding menu items."}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        restaurant = Restaurant.objects.filter(owner=self.request.user).first()
        serializer.save(restaurant=restaurant)

    def get_queryset(self):
        queryset = MenuItem.objects.all()
        restaurant_id = self.request.query_params.get('restaurant_id', None)
        if restaurant_id is not None:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        return queryset


class RestaurantNotificationViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RestaurantNotification.objects.filter(user=self.request.user)

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
