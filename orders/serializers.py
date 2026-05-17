from rest_framework import serializers
from .models import Order, OrderItem
from shops.serializers import ProductSerializer, ShopSerializer
from users.serializers import UserSerializer

class OrderItemSerializer(serializers.ModelSerializer):
    product_details = ProductSerializer(source='product', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_details', 'quantity', 'price']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_details = UserSerializer(source='customer', read_only=True)
    driver_details = UserSerializer(source='driver', read_only=True)
    shop_details = ShopSerializer(source='shop', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'customer', 'customer_details', 'shop', 'shop_details',
            'driver', 'driver_details', 'total_price', 'status', 'address',
            'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['customer', 'driver', 'total_price', 'status']
