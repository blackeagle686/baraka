from django.db import models
from django.contrib.auth.models import AbstractUser

class UserRole(models.TextChoices):
    CUSTOMER = 'CUSTOMER', 'Customer'
    SHOP_OWNER = 'SHOP_OWNER', 'Shop Owner'
    DRIVER = 'DRIVER', 'Driver'
    ADMIN = 'ADMIN', 'Admin'

class User(AbstractUser):
    username = None # Remove username field
    phone = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    image = models.ImageField(upload_to='profiles/', blank=True, null=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CUSTOMER
    )

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.phone
