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
        fields = [
            'name', 'description', 'image', 'address',
            'latitude', 'longitude', 'is_open',
            'opening_time', 'closing_time'
        ]


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
