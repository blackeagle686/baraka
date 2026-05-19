from rest_framework import serializers
from django.contrib.auth import get_user_model
from .validators import validate_egyptian_phone, validate_strong_password, validate_secure_file

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'phone', 'name', 'location', 'latitude', 'longitude', 'image', 'role', 'password', 'is_approved', 'is_active')
        extra_kwargs = {
            'password': {'write_only': True},
            'latitude': {'required': False, 'allow_null': True},
            'longitude': {'required': False, 'allow_null': True},
            'image': {'required': False, 'allow_null': True},
            'is_approved': {'read_only': True},
            'is_active': {'read_only': True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # If the user is a Django superuser/staff, ensure their frontend role is ADMIN
        if instance.is_staff or instance.is_superuser:
            data['role'] = 'ADMIN'
        return data

    def validate_phone(self, value):
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            return validate_egyptian_phone(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message)

    def validate_password(self, value):
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            return validate_strong_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message)

    def validate_image(self, value):
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            return validate_secure_file(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message)

    def create(self, validated_data):
        role = validated_data.get('role', 'CUSTOMER')
        # Shop owners and drivers need admin approval
        needs_approval = role in ('SHOP_OWNER', 'DRIVER')
        user = User.objects.create_user(
            phone=validated_data['phone'],
            password=validated_data['password'],
            name=validated_data.get('name', ''),
            location=validated_data.get('location', ''),
            latitude=validated_data.get('latitude', None),
            longitude=validated_data.get('longitude', None),
            role=role,
            is_approved=not needs_approval
        )
        return user


class AdminUserSerializer(serializers.ModelSerializer):
    """Full serializer for admin to manage users (can write is_approved, is_active)."""
    class Meta:
        model = User
        fields = ('id', 'phone', 'name', 'location', 'role', 'is_approved', 'is_active', 'date_joined', 'image')
        read_only_fields = ('id', 'phone', 'date_joined')

