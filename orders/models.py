from django.db import models
from django.conf import settings
from shops.models import Shop, Product

class Cart(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

class OrderStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    PREPARING = 'PREPARING', 'Preparing'
    ON_DELIVERY = 'ON_DELIVERY', 'On Delivery'
    DELIVERED = 'DELIVERED', 'Delivered'
    CANCELLED = 'CANCELLED', 'Cancelled'
    PENDING_RETURN = 'PENDING_RETURN', 'Pending Return'

class Order(models.Model):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='customer_orders')
    shop = models.ForeignKey(Shop, on_delete=models.SET_NULL, null=True, blank=True, related_name='shop_orders')
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='driver_orders')
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_price = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    address = models.TextField()
    is_paid_to_shop = models.BooleanField(default=False)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    
    # Mutual Trust Zero-Knowledge OTP Keys
    customer_otp = models.CharField(max_length=4, blank=True, null=True)
    driver_otp = models.CharField(max_length=4, blank=True, null=True)
    
    # Dispute Mediation Layer
    dispute_status = models.CharField(max_length=20, default='NONE') # NONE, PENDING, RESOLVED
    dispute_reason = models.TextField(blank=True, null=True)
    disputed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='raised_disputes')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        import random
        from django.utils import timezone
        if not self.customer_otp:
            self.customer_otp = f"{random.randint(1000, 9999)}"
        if not self.driver_otp:
            self.driver_otp = f"{random.randint(1000, 9999)}"
        if self.status == 'ON_DELIVERY' and not self.picked_up_at:
            self.picked_up_at = timezone.now()
        super().save(*args, **kwargs)

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2) # Snapshot of price at the time of order
    is_ready = models.BooleanField(default=False)

class DriverRating(models.Model):
    class RaterType(models.TextChoices):
        CUSTOMER = 'CUSTOMER', 'Customer'
        SHOP_OWNER = 'SHOP_OWNER', 'Shop Owner'

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='driver_ratings')
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='driver_received_ratings')
    rater = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='driver_given_ratings')
    rater_type = models.CharField(max_length=20, choices=RaterType.choices)
    rating = models.PositiveSmallIntegerField() # 1 to 5
    review = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('order', 'rater', 'rater_type')

    def __str__(self):
        return f"{self.rater_type} rated driver {self.driver.phone} - {self.rating}★"
