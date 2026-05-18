from rest_framework import serializers
from .models import Shop, Category, Product, ShopRating

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['shop']

class ShopRatingSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.first_name')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')

    class Meta:
        model = ShopRating
        fields = ['id', 'shop', 'customer_name', 'customer_phone', 'rating', 'review', 'created_at']
        read_only_fields = ['customer']

class ShopSerializer(serializers.ModelSerializer):
    products = ProductSerializer(many=True, read_only=True)
    owner_phone = serializers.ReadOnlyField(source='owner.phone')
    average_rating = serializers.SerializerMethodField()
    total_ratings = serializers.SerializerMethodField()
    ratings_list = ShopRatingSerializer(source='ratings', many=True, read_only=True)

    class Meta:
        model = Shop
        fields = '__all__'
        read_only_fields = ['owner']

    def get_average_rating(self, obj):
        ratings = obj.ratings.all()
        if ratings.exists():
            return round(sum(r.rating for r in ratings) / len(ratings), 1)
        return 0.0

    def get_total_ratings(self, obj):
        return obj.ratings.count()
