from rest_framework import serializers
from .models import Order, OrderItem, DriverRating
from shops.models import Shop, Product
from restaurants.models import Restaurant, MenuItem
from users.serializers import UserSerializer

class DriverRatingSerializer(serializers.ModelSerializer):
    rater_name = serializers.ReadOnlyField(source='rater.first_name')
    rater_phone = serializers.ReadOnlyField(source='rater.phone')
    driver_name = serializers.ReadOnlyField(source='driver.first_name')

    class Meta:
        model = DriverRating
        fields = ['id', 'order', 'driver', 'driver_name', 'rater', 'rater_name', 'rater_phone', 'rater_type', 'rating', 'review', 'created_at']
        read_only_fields = ['rater', 'driver', 'rater_type']

# ── Lightweight serializers for order context (avoid loading full shop catalog) ──
class ProductLiteSerializer(serializers.ModelSerializer):
    """Minimal product info for order items — no shop/category overhead."""
    category_name = serializers.ReadOnlyField(source='category.name')
    shop_id = serializers.ReadOnlyField(source='shop.id')
    shop_name = serializers.ReadOnlyField(source='shop.name')

    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'image', 'category_name', 'available', 'shop_id', 'shop_name']

class ShopLiteSerializer(serializers.ModelSerializer):
    """Minimal shop info for order responses — skips products & ratings."""
    owner_phone = serializers.ReadOnlyField(source='owner.phone')

    class Meta:
        model = Shop
        fields = ['id', 'name', 'owner', 'owner_phone', 'address', 'image']

class MenuItemLiteSerializer(serializers.ModelSerializer):
    """Minimal menu item info for order items."""
    restaurant_id = serializers.ReadOnlyField(source='restaurant.id')
    restaurant_name = serializers.ReadOnlyField(source='restaurant.name')

    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'price', 'image', 'available', 'restaurant_id', 'restaurant_name']

class RestaurantLiteSerializer(serializers.ModelSerializer):
    """Minimal restaurant info for order responses."""
    owner_phone = serializers.ReadOnlyField(source='owner.phone')

    class Meta:
        model = Restaurant
        fields = ['id', 'name', 'owner', 'owner_phone', 'address', 'image']

class OrderItemSerializer(serializers.ModelSerializer):
    product_details = ProductLiteSerializer(source='product', read_only=True)
    menu_item_details = MenuItemLiteSerializer(source='menu_item', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_details', 'menu_item', 'menu_item_details', 'quantity', 'price', 'is_ready']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_details = UserSerializer(source='customer', read_only=True)
    driver_details = UserSerializer(source='driver', read_only=True)
    shop_details = ShopLiteSerializer(source='shop', read_only=True)
    shops_details = serializers.SerializerMethodField()
    restaurant_details = RestaurantLiteSerializer(source='restaurant', read_only=True)
    restaurants_details = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'customer', 'customer_details', 'shop', 'shop_details', 'shops_details',
            'restaurant', 'restaurant_details', 'restaurants_details',
            'driver', 'driver_details', 'total_price', 'delivery_price', 'status', 'address',
            'is_paid_to_shop', 'paid_shops', 'postponed_shops', 'picked_up_at',
            'customer_otp', 'driver_otp', 'dispute_status',
            'dispute_reason', 'disputed_by', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['customer', 'driver', 'total_price', 'status', 'customer_otp', 'driver_otp']

    def get_shops_details(self, obj):
        shops = set()
        for item in obj.items.all():
            if item.product and item.product.shop:
                shops.add(item.product.shop)
        return ShopLiteSerializer(shops, many=True).data

    def get_restaurants_details(self, obj):
        restaurants = set()
        for item in obj.items.all():
            if item.menu_item and item.menu_item.restaurant:
                restaurants.add(item.menu_item.restaurant)
        return RestaurantLiteSerializer(restaurants, many=True).data

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')

        ret.pop('customer_otp', None)
        ret.pop('driver_otp', None)

        if request and request.user.is_authenticated:
            if instance.customer == request.user or request.user.is_staff:
                ret['customer_otp'] = instance.customer_otp

            if instance.driver == request.user or request.user.is_staff:
                ret['driver_otp'] = instance.driver_otp
                shop_otps = {}
                for item in instance.items.all():
                    if item.product and item.product.shop:
                        shop_otps[str(item.product.shop.id)] = instance.get_or_create_shop_otp(item.product.shop.id)
                    if item.menu_item and item.menu_item.restaurant:
                        shop_otps[f"r_{item.menu_item.restaurant.id}"] = instance.get_or_create_shop_otp(f"r_{item.menu_item.restaurant.id}")
                ret['shop_otps_map'] = shop_otps

            from shops.models import Shop
            shops_owned_by_user = Shop.objects.filter(owner=request.user)
            order_items_belonging_to_user_shops = instance.items.filter(product__shop__in=shops_owned_by_user)
            if order_items_belonging_to_user_shops.exists():
                ret['my_shop_otp'] = instance.get_or_create_shop_otp(
                    order_items_belonging_to_user_shops.first().product.shop.id
                )

            from restaurants.models import Restaurant
            restaurants_owned_by_user = Restaurant.objects.filter(owner=request.user)
            order_menu_items_belonging_to_user = instance.items.filter(menu_item__restaurant__in=restaurants_owned_by_user)
            if order_menu_items_belonging_to_user.exists():
                ret['my_restaurant_otp'] = instance.get_or_create_shop_otp(
                    f"r_{order_menu_items_belonging_to_user.first().menu_item.restaurant.id}"
                )

        return ret
