# Restaurant Service Implementation Plan

## Files to Modify (existing)

### 1. `users/models.py`
- Add `RESTAURANT_OWNER = 'RESTAURANT_OWNER', 'Restaurant Owner'` to `UserRole` enum

### 2. `users/serializers.py` (line 49)
- Change `needs_approval = role in ('SHOP_OWNER', 'DRIVER')` to `needs_approval = role in ('SHOP_OWNER', 'RESTAURANT_OWNER', 'DRIVER')`

### 3. `backend/settings.py` (line 63)
- Add `'restaurants',` to INSTALLED_APPS after `'clinics',`

### 4. `backend/urls.py` (line 18)
- Add `path('api/', include('restaurants.urls')),` after `clinics` line

### 5. `orders/models.py`
Add to Order model:
```python
restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
```
Add to OrderItem model:
```python
menu_item = models.ForeignKey('restaurants.MenuItem', on_delete=models.SET_NULL, null=True, blank=True)
```
Modify `has_unpaid_non_postponed_shops` to also check restaurant items:
```python
def has_unpaid_non_postponed_shops(self):
    if self.is_paid_to_shop:
        return False
    involved_shop_ids = set()
    involved_restaurant_ids = set()
    for item in self.items.all():
        if item.product and item.product.shop:
            involved_shop_ids.add(str(item.product.shop.id))
        if item.menu_item and item.menu_item.restaurant:
            involved_restaurant_ids.add(str(item.menu_item.restaurant.id))
    paid_shop_ids = set(sid for sid in self.paid_shops.split(',') if sid)
    postponed_shop_ids = set(sid for sid in self.postponed_shops.split(',') if sid)
    unpaid_non_postponed = (involved_shop_ids - paid_shop_ids - postponed_shop_ids)
    return len(unpaid_non_postponed) > 0
```
Modify `DriverRating.RaterType` to add `RESTAURANT_OWNER`:
```python
class RaterType(models.TextChoices):
    CUSTOMER = 'CUSTOMER', 'Customer'
    SHOP_OWNER = 'SHOP_OWNER', 'Shop Owner'
    RESTAURANT_OWNER = 'RESTAURANT_OWNER', 'Restaurant Owner'
```

### 6. `orders/serializers.py`
Add `from restaurants.models import Restaurant, MenuItem` import.
Add `MenuItemLiteSerializer` (mirrors `ProductLiteSerializer`):
```python
class MenuItemLiteSerializer(serializers.ModelSerializer):
    """Minimal menu item info for order items."""
    restaurant_id = serializers.ReadOnlyField(source='restaurant.id')
    restaurant_name = serializers.ReadOnlyField(source='restaurant.name')
    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'price', 'image', 'available', 'restaurant_id', 'restaurant_name']
```
Add `RestaurantLiteSerializer` (mirrors `ShopLiteSerializer`):
```python
class RestaurantLiteSerializer(serializers.ModelSerializer):
    owner_phone = serializers.ReadOnlyField(source='owner.phone')
    class Meta:
        model = Restaurant
        fields = ['id', 'name', 'owner', 'owner_phone', 'address', 'image']
```
Modify `OrderItemSerializer` to add `menu_item_details`:
```python
menu_item_details = MenuItemLiteSerializer(source='menu_item', read_only=True)
```
Modify `OrderSerializer` to add `restaurant`, `restaurant_details`, `restaurants_details`:
```python
restaurant_details = RestaurantLiteSerializer(source='restaurant', read_only=True)
restaurants_details = serializers.SerializerMethodField()
```
Add `get_restaurants_details` method (mirrors `get_shops_details`).
Modify `to_representation` to handle restaurant OTPs:
- For drivers: also generate OTPs for restaurants
- For restaurant owners: show `my_restaurant_otp` instead of `my_shop_otp`

### 7. `orders/views.py`
- Add `from restaurants.models import Restaurant, MenuItem, RestaurantNotification` import
- Modify `get_queryset()`:
  - Add `RESTAURANT_OWNER` case (mirrors SHOP_OWNER but filters by menu_item__restaurant)
  - DRIVER already sees all orders - keep as is
- Modify `create()`:
  - Accept `menu_items` alongside `items` in request data
  - Look up MenuItem objects with `select_for_update()`
  - Calculate total price from both products and menu_items
  - Create OrderItems for menu_items
  - Notify restaurant owners
- Modify `update_status()`:
  - Check if user is restaurant owner (order.items.filter(menu_item__restaurant__owner=user).exists())
- Modify `accept_delivery()`:
  - Notify restaurant owners alongside shop owners
- Modify `confirm_payment_received()`:
  - Also handle restaurant settlement
- Modify `postpone_shop_settlement()`:
  - Also handle restaurant postponement  
- Modify `raise_dispute()`:
  - Add restaurant owner check
- Modify `toggle_item_ready()`:
  - Allow restaurant owners too
- Modify `report_emergency()`:
  - Also notify restaurant owners
- Modify `confirm_emergency_returned()`:
  - Also handle restaurant owners
- Modify `rate_driver()`:
  - Allow restaurant owners to rate
- Modify `driver_rating_status()`:
  - Allow restaurant owners to check

### 8. `frontend/js/auth.js`
Add to ALL 4 role-routing blocks:
```javascript
} else if (role === 'RESTAURANT_OWNER') {
    window.location.href = '/html/profile/restaurant.html';
```

### 9. `frontend/js/main.js`
In customer nav section, add after "عيادات القرية":
```javascript
<a class="nav-link d-flex align-items-center gap-2 fw-bold text-espresso me-3" href="/html/restaurants/list.html" style="font-size: 0.95rem; color: var(--color-espresso) !important;">
    <i class="bi bi-shop fs-5 text-mesa"></i>
    <span>مطاعم القرية</span>
</a>
```
In role badge section, add after DOCTOR:
```javascript
} else if (userRole === 'RESTAURANT_OWNER') {
    roleBadge = `<a href="/html/profile/restaurant.html" class="btn btn-orange btn-sm rounded-pill fw-bold text-white px-3 py-1 me-2" style="font-size: 0.8rem; background: #f97316; border-color: #f97316;"><i class="bi bi-shop me-1"></i>مطعمي</a>`;
```

### 10. `frontend/html/auth/login.html`
Add to registration role dropdown:
```html
<option value="RESTAURANT_OWNER">صاحب مطعم (بيع وجبات) 🍽️</option>
```

### 11. `frontend/js/cart.js`
- Add restaurant order tracking alongside shop orders
- Handle MenuItem items in cart display (distinguish from Product items)

---

## Files to Create (new)

### 12. `restaurants/__init__.py`
```python
# Empty
```

### 13. `restaurants/apps.py`
```python
from django.apps import AppConfig

class RestaurantsConfig(AppConfig):
    name = 'restaurants'
```

### 14. `restaurants/models.py`
```python
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

class Restaurant(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='restaurants')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='restaurants/', blank=True, null=True)
    address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_open = models.BooleanField(default=True)
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class MenuCategory(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = 'Menu Categories'

class MenuItem(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='menu_items')
    category = models.ForeignKey(MenuCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='menu_items')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='menu_items/', blank=True, null=True)
    quantity = models.PositiveIntegerField(default=10)
    available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class RestaurantRating(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='ratings')
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='restaurant_ratings')
    rating = models.PositiveSmallIntegerField()
    review = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('restaurant', 'customer')

    def __str__(self):
        return f"{self.customer} rated {self.restaurant.name} - {self.rating}★"

class RestaurantNotification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='restaurant_notifications')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, default='info')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.phone} - {self.title}"

@receiver([post_save, post_delete], sender=Restaurant)
def invalidate_restaurants_cache(sender, instance, **kwargs):
    try:
        current_version = cache.get("restaurants_list_version", 1)
        cache.set("restaurants_list_version", current_version + 1, timeout=None)
    except Exception:
        pass

@receiver([post_save, post_delete], sender=MenuItem)
def invalidate_menu_items_cache(sender, instance, **kwargs):
    try:
        current_version = cache.get("menu_items_list_version", 1)
        cache.set("menu_items_list_version", current_version + 1, timeout=None)
    except Exception:
        pass

@receiver([post_save, post_delete], sender=MenuCategory)
def invalidate_menu_categories_cache(sender, instance, **kwargs):
    try:
        current_version = cache.get("menu_categories_version", 1)
        cache.set("menu_categories_version", current_version + 1, timeout=None)
    except Exception:
        pass
```

### 15. `restaurants/serializers.py`
```python
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Restaurant, MenuCategory, MenuItem, RestaurantRating, RestaurantNotification
from users.validators import validate_secure_file

class MenuCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuCategory
        fields = '__all__'

class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')

    def validate_image(self, value):
        try:
            return validate_secure_file(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message)

    class Meta:
        model = MenuItem
        fields = '__all__'
        read_only_fields = ['restaurant']

class RestaurantRatingSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.name')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')

    class Meta:
        model = RestaurantRating
        fields = ['id', 'restaurant', 'customer_name', 'customer_phone', 'rating', 'review', 'created_at']
        read_only_fields = ['customer']

class RestaurantCreateSerializer(serializers.ModelSerializer):
    def validate_image(self, value):
        try:
            return validate_secure_file(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message)

    class Meta:
        model = Restaurant
        fields = ['name', 'description', 'image', 'address', 'latitude', 'longitude', 'is_open', 'opening_time', 'closing_time']

class RestaurantSerializer(serializers.ModelSerializer):
    menu_items = MenuItemSerializer(many=True, read_only=True)
    owner_phone = serializers.ReadOnlyField(source='owner.phone')

    def validate_image(self, value):
        try:
            return validate_secure_file(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message)

    average_rating = serializers.SerializerMethodField()
    total_ratings = serializers.SerializerMethodField()
    ratings_list = RestaurantRatingSerializer(source='ratings', many=True, read_only=True)

    class Meta:
        model = Restaurant
        fields = '__all__'
        read_only_fields = ['owner']

    def get_average_rating(self, obj):
        ratings = obj.ratings.all()
        if ratings.exists():
            return round(sum(r.rating for r in ratings) / len(ratings), 1)
        return 0.0

    def get_total_ratings(self, obj):
        return obj.ratings.count()

class RestaurantNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantNotification
        fields = '__all__'
```

### 16. `restaurants/permissions.py`
```python
from rest_framework import permissions

class IsRestaurantOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        elif hasattr(obj, 'restaurant'):
            return obj.restaurant.owner == request.user
        return False
```

### 17. `restaurants/views.py`
```python
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.core.cache import cache
import hashlib

from orders.models import Order, OrderStatus
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
```

### 18. `restaurants/urls.py`
```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RestaurantViewSet, MenuCategoryViewSet, MenuItemViewSet, RestaurantNotificationViewSet

router = DefaultRouter()
router.register(r'restaurants', RestaurantViewSet)
router.register(r'menu-categories', MenuCategoryViewSet)
router.register(r'menu-items', MenuItemViewSet)
router.register(r'restaurant-notifications', RestaurantNotificationViewSet, basename='restaurant-notification')

urlpatterns = [
    path('', include(router.urls)),
]
```

### 19. `restaurants/tasks.py`
```python
from celery import shared_task
from django.utils import timezone
from .models import Restaurant, RestaurantNotification
import logging
from datetime import time
import zoneinfo

logger = logging.getLogger(__name__)

@shared_task
def check_restaurant_working_hours(simulated_time_str=None):
    if simulated_time_str:
        try:
            sim_h, sim_m = map(int, simulated_time_str.split(':'))
            now_time = time(sim_h, sim_m)
        except Exception as e:
            logger.error(f"[SIMULATION] Failed to parse simulated time '{simulated_time_str}': {e}")
            return "Failed: Invalid simulated time format."
    else:
        try:
            cairo_tz = zoneinfo.ZoneInfo("Africa/Cairo")
            now_local = timezone.now().astimezone(cairo_tz)
        except Exception:
            now_local = timezone.localtime(timezone.now())
        now_time = now_local.time()

    try:
        cairo_tz = zoneinfo.ZoneInfo("Africa/Cairo")
        today = timezone.now().astimezone(cairo_tz).date()
    except Exception:
        today = timezone.localtime(timezone.now()).date()

    current_hour = now_time.hour
    current_minute = now_time.minute

    opening_restaurants = Restaurant.objects.filter(
        opening_time__hour=current_hour,
        opening_time__minute=current_minute
    )
    for restaurant in opening_restaurants:
        already_alerted = RestaurantNotification.objects.filter(
            restaurant=restaurant,
            notification_type='restaurant_open_alert',
            created_at__date=today
        ).exists()
        if not already_alerted:
            RestaurantNotification.objects.create(
                user=restaurant.owner,
                restaurant=restaurant,
                title="حان وقت فتح المطعم! 🍽️",
                message=f"يا غالي، الساعة دلوقتي {now_time.strftime('%H:%M')} ووفقاً لمواعيد عملك، حان وقت فتح مطعم '{restaurant.name}'. اضغط هنا لتعديل حالة المطعم واستقبال طلبات أهل قريتك!",
                notification_type='restaurant_open_alert'
            )

    closing_restaurants = Restaurant.objects.filter(
        closing_time__hour=current_hour,
        closing_time__minute=current_minute
    )
    for restaurant in closing_restaurants:
        already_alerted = RestaurantNotification.objects.filter(
            restaurant=restaurant,
            notification_type='restaurant_close_alert',
            created_at__date=today
        ).exists()
        if not already_alerted:
            RestaurantNotification.objects.create(
                user=restaurant.owner,
                restaurant=restaurant,
                title="حان وقت إغلاق المطعم! 🔒",
                message=f"يا غالي، الساعة دلوقتي {now_time.strftime('%H:%M')} ووفقاً لمواعيد عملك، حان وقت إغلاق مطعم '{restaurant.name}'. اضغط هنا لإغلاق المطعم لترتاح وتتوقف عن استقبال الطلبات مؤقتاً.",
                notification_type='restaurant_close_alert'
            )

    return "Restaurant hours checked successfully."
```

### 20. `frontend/js/api.js`
Add after the `clinics` namespace:
```javascript
restaurants: {
    getAll: async (page = 1, search = '') => {
        const url = new URL(`${API_BASE}/restaurants/`, window.location.origin);
        if (page) url.searchParams.append('page', page);
        if (search) url.searchParams.append('search', search);
        const res = await fetch(url.toString());
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    getById: async (id) => {
        const res = await fetch(`${API_BASE}/restaurants/${id}/`);
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    getRatingStatus: async (token, id) => {
        const res = await fetch(`${API_BASE}/restaurants/${id}/rating_status/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    rateRestaurant: async (token, id, rating, review = '') => {
        const res = await fetch(`${API_BASE}/restaurants/${id}/rate/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ rating, review })
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    getMenuItems: async (restaurantId) => {
        const res = await fetch(`${API_BASE}/menu-items/?restaurant_id=${restaurantId}`);
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    getMyRestaurant: async (token) => {
        const res = await fetch(`${API_BASE}/restaurants/my_restaurant/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 404) return null;
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    createRestaurant: async (token, formData) => {
        const res = await fetch(`${API_BASE}/restaurants/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    updateRestaurant: async (token, restaurantId, formData) => {
        const res = await fetch(`${API_BASE}/restaurants/${restaurantId}/`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    toggleStatus: async (token, restaurantId) => {
        const res = await fetch(`${API_BASE}/restaurants/${restaurantId}/toggle_status/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    }
},
menuItems: {
    getAll: async (restaurantId) => {
        const res = await fetch(`${API_BASE}/menu-items/?restaurant_id=${restaurantId}`);
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    create: async (token, formData) => {
        const res = await fetch(`${API_BASE}/menu-items/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    update: async (token, itemId, formData) => {
        const res = await fetch(`${API_BASE}/menu-items/${itemId}/`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    delete: async (token, itemId) => {
        const res = await fetch(`${API_BASE}/menu-items/${itemId}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw await res.json();
        return true;
    }
},
menuCategories: {
    getAll: async () => {
        const res = await fetch(`${API_BASE}/menu-categories/`);
        if (!res.ok) throw await res.json();
        return await res.json();
    }
},
restaurantNotifications: {
    getAll: async (token) => {
        const res = await fetch(`${API_BASE}/restaurant-notifications/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    getUnreadCount: async (token) => {
        const notifications = await api.restaurantNotifications.getAll(token);
        return notifications.filter(n => !n.is_read).length;
    },
    markRead: async (token, id) => {
        const res = await fetch(`${API_BASE}/restaurant-notifications/${id}/mark_read/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    },
    markAllRead: async (token) => {
        const res = await fetch(`${API_BASE}/restaurant-notifications/mark_all_read/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw await res.json();
        return await res.json();
    }
}
```

### 21. Frontend pages to create:
- `frontend/html/profile/restaurant.html` - Dashboard (mirror `shop.html`)
- `frontend/js/restaurant_profile.js` - Dashboard logic (mirror `shop_profile.js`)
- `frontend/js/restaurant_revenue.js` - Revenue (mirror `shop_revenue.js`)
- `frontend/html/restaurants/list.html` - Directory (mirror `shops/list.html`)
- `frontend/html/restaurants/details.html` - Detail + ordering (mirror `shops/details.html`)
- `frontend/js/restaurants.js` - List + detail logic (mirror `shops.js`)
- `frontend/js/restaurant_list.js` - Mobile toggle (mirror `shop_list.js`)
- `frontend/css/restaurants.css` - Styling (mirror `shops.css`)
- `frontend/img/restaurant-placeholder.png` - Default image

### 22. `restaurants/admin.py`
```python
from django.contrib import admin
from .models import Restaurant, MenuCategory, MenuItem, RestaurantRating, RestaurantNotification

admin.site.register(Restaurant)
admin.site.register(MenuCategory)
admin.site.register(MenuItem)
admin.site.register(RestaurantRating)
admin.site.register(RestaurantNotification)
```

## Implementation Order
1. UserRole + setting registration (quick edits)
2. Restaurants app (models.py first, then serializers/permissions/views/urls)
3. Extend orders/models.py (add restaurant/menu_item FKs)
4. Extend orders/views.py and serializers.py (restaurant-aware order handling)
5. Frontend API client additions
6. Frontend auth/main/login updates
7. Frontend dashboard, directory, detail pages
8. Migrations
