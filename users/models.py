from django.db import models
from django.contrib.auth.models import AbstractUser

class UserRole(models.TextChoices):
    CUSTOMER = 'CUSTOMER', 'Customer'
    SHOP_OWNER = 'SHOP_OWNER', 'Shop Owner'
    DRIVER = 'DRIVER', 'Driver'
    ADMIN = 'ADMIN', 'Admin'

class User(AbstractUser):
    phone = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CUSTOMER
    )
