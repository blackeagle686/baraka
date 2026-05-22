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
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='driver_orders')
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_price = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    address = models.TextField()
    is_paid_to_shop = models.BooleanField(default=False)
    paid_shops = models.TextField(blank=True, default='')
    shop_otps = models.TextField(blank=True, default='')
    postponed_shops = models.TextField(blank=True, default='')
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

    def has_unpaid_non_postponed_shops(self):
        if self.is_paid_to_shop:
            return False
        involved_shop_ids = set()
        for item in self.items.all():
            if item.product and item.product.shop:
                involved_shop_ids.add(str(item.product.shop.id))
            if item.menu_item and item.menu_item.restaurant:
                involved_shop_ids.add(f"r_{item.menu_item.restaurant.id}")
        paid_shop_ids = set(sid for sid in self.paid_shops.split(',') if sid)
        postponed_shop_ids = set(sid for sid in self.postponed_shops.split(',') if sid)
        unpaid_non_postponed = involved_shop_ids - paid_shop_ids - postponed_shop_ids
        return len(unpaid_non_postponed) > 0

    def get_or_create_shop_otp(self, shop_id):
        import random
        shop_id_str = str(shop_id)
        pairs = {}
        if self.shop_otps:
            for pair in self.shop_otps.split(','):
                if ':' in pair:
                    k, v = pair.split(':', 1)
                    pairs[k] = v
                    
        if shop_id_str in pairs:
            return pairs[shop_id_str]
            
        new_otp = f"{random.randint(1000, 9999)}"
        pairs[shop_id_str] = new_otp
        self.shop_otps = ','.join(f"{k}:{v}" for k, v in pairs.items())
        self.save(update_fields=['shop_otps'])
        return new_otp

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
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    menu_item = models.ForeignKey('restaurants.MenuItem', on_delete=models.SET_NULL, null=True, blank=True)
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
