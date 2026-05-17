from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'phone', 'name', 'location', 'latitude', 'longitude', 'image', 'role', 'password')
        extra_kwargs = {
            'password': {'write_only': True},
            'latitude': {'required': False, 'allow_null': True},
            'longitude': {'required': False, 'allow_null': True},
            'image': {'required': False, 'allow_null': True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            phone=validated_data['phone'],
            password=validated_data['password'],
            name=validated_data.get('name', ''),
            location=validated_data.get('location', ''),
            latitude=validated_data.get('latitude', None),
            longitude=validated_data.get('longitude', None),
            role=validated_data.get('role', 'CUSTOMER')
        )
        return user
