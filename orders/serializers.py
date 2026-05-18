from rest_framework import serializers
from .models import Order, OrderItem, DriverRating
from shops.models import Shop, Product
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

    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'image', 'category_name', 'available']

class ShopLiteSerializer(serializers.ModelSerializer):
    """Minimal shop info for order responses — skips products & ratings."""
    owner_phone = serializers.ReadOnlyField(source='owner.phone')

    class Meta:
        model = Shop
        fields = ['id', 'name', 'owner', 'owner_phone', 'address', 'image']

class OrderItemSerializer(serializers.ModelSerializer):
    product_details = ProductLiteSerializer(source='product', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_details', 'quantity', 'price']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_details = UserSerializer(source='customer', read_only=True)
    driver_details = UserSerializer(source='driver', read_only=True)
    shop_details = ShopLiteSerializer(source='shop', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'customer', 'customer_details', 'shop', 'shop_details',
            'driver', 'driver_details', 'total_price', 'delivery_price', 'status', 'address',
            'is_paid_to_shop', 'customer_otp', 'driver_otp', 'dispute_status', 
            'dispute_reason', 'disputed_by', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['customer', 'driver', 'total_price', 'status', 'customer_otp', 'driver_otp']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        
        # Safe pop by default so no third party gets these private trust tokens
        ret.pop('customer_otp', None)
        ret.pop('driver_otp', None)
        
        if request and request.user.is_authenticated:
            # Only the actual customer of this order can see the delivery verification OTP
            if instance.customer == request.user or request.user.is_staff:
                ret['customer_otp'] = instance.customer_otp
                
            # Only the actual driver of this order can see the settlement verification OTP
            if instance.driver == request.user or request.user.is_staff:
                ret['driver_otp'] = instance.driver_otp
                
        return ret
