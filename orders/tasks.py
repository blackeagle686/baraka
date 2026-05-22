from celery import shared_task
import time
import logging

logger = logging.getLogger(__name__)

@shared_task
def send_order_notifications_to_drivers(order_id):
    """
    Simulates sending instant push notifications or SMS alerts to all nearby drivers
    in the background. This avoids blocking the main HTTP request thread during checkout!
    """
    logger.info(f"🚀 Starting background driver notification dispatch for Order #{order_id}...")
    
    # Simulate heavy network communication or third-party SMS gateway call
    time.sleep(3) 
    
    logger.info(f"✅ Notification dispatch complete. All nearby drivers notified about Order #{order_id}!")
    return f"Order {order_id} notification sent successfully."

@shared_task
def auto_cancel_expired_orders(order_id):
    """
    Retrieves a PENDING order after 30 minutes and cancels it if no action is taken,
    restoring inventory stock atomically.
    """
    from django.db import transaction
    from .models import Order, OrderStatus
    from shops.models import Notification
    from django.utils import timezone
    from datetime import timedelta
    
    logger.info(f"⏳ Running stock recovery / auto-cancel check for Order #{order_id}...")
    try:
        with transaction.atomic():
            order = Order.objects.select_for_update().get(id=order_id)
            if order.status == 'PENDING':
                # Prevent cancellation if the order was created less than 28 minutes ago
                # (e.g. if Celery is running synchronously with CELERY_TASK_ALWAYS_EAGER)
                time_elapsed = timezone.now() - order.created_at
                if time_elapsed < timedelta(minutes=28):
                    logger.info(f"⏳ Order #{order_id} check ran, but it was created only {time_elapsed.total_seconds() / 60:.1f} minutes ago. Skipping cancellation.")
                    return f"Order {order_id} check skipped: too fresh ({time_elapsed.total_seconds() / 60:.1f}m old)."
                
                logger.info(f"🚨 Order #{order_id} remained PENDING for 30 minutes. Automatically cancelling order and releasing stock...")
                order.status = 'CANCELLED'
                order.save()
                
                # Restore stock for each item in the order
                for item in order.items.all():
                    if item.product:
                        item.product.quantity += item.quantity
                        item.product.available = True
                        item.product.save()
                        logger.info(f"📦 Restored {item.quantity} units for product '{item.product.name}'.")
                        
                # Notify customer about auto-cancellation
                Notification.objects.create(
                    user=order.customer,
                    title="⏳ تم إلغاء الطلب تلقائياً لعدم الاستجابة",
                    message=f"عذراً، تم إلغاء طلبك #{order.id} تلقائياً لعدم قبول المحل أو توفر طيار خلال 30 دقيقة. تم إرجاع المنتجات للمخزن.",
                    notification_type='order_auto_cancelled'
                )
                return f"Order {order_id} successfully auto-cancelled."
            else:
                logger.info(f"✅ Order #{order_id} status is '{order.status}'. No cancel action needed.")
                return f"Order {order_id} status is {order.status}. No action taken."
    except Order.DoesNotExist:
        logger.warning(f"⚠️ Order #{order_id} does not exist.")
        return f"Order {order_id} not found."

@shared_task
def recalculate_shop_rating_stats(shop_id):
    """
    Asynchronously aggregates ratings for a shop and updates cache and lists.
    """
    from shops.models import Shop, ShopRating
    from django.db.models import Avg, Count
    from django.core.cache import cache
    
    logger.info(f"📊 Recalculating rating statistics for Shop #{shop_id}...")
    try:
        shop = Shop.objects.get(id=shop_id)
        stats = ShopRating.objects.filter(shop=shop).aggregate(
            avg_rating=Avg('rating'),
            total_reviews=Count('id')
        )
        
        # Save average and count into cache for immediate zero-DB reading
        cache.set(f"shop_rating_avg:{shop_id}", stats['avg_rating'] or 0.0, timeout=None)
        cache.set(f"shop_rating_count:{shop_id}", stats['total_reviews'] or 0, timeout=None)
        
        # Invalidate shops lists versioning to display fresh averages
        current_version = cache.get("shops_list_version", 1)
        cache.set("shops_list_version", current_version + 1, timeout=None)
        
        logger.info(f"✅ Shop #{shop_id} average rating recalculated: {stats['avg_rating']}★ across {stats['total_reviews']} reviews.")
        return f"Shop {shop_id} rating stats updated successfully."
    except Shop.DoesNotExist:
        logger.warning(f"⚠️ Shop #{shop_id} not found.")
        return f"Shop {shop_id} not found."

@shared_task
def recalculate_driver_rating_stats(driver_id):
    """
    Asynchronously aggregates ratings for a driver.
    """
    from django.contrib.auth import get_user_model
    from .models import DriverRating
    from django.db.models import Avg, Count
    from django.core.cache import cache
    
    User = get_user_model()
    logger.info(f"📊 Recalculating rating statistics for Driver #{driver_id}...")
    try:
        driver = User.objects.get(id=driver_id)
        stats = DriverRating.objects.filter(driver=driver).aggregate(
            avg_rating=Avg('rating'),
            total_reviews=Count('id')
        )
        
        # Cache driver averages
        cache.set(f"driver_rating_avg:{driver_id}", stats['avg_rating'] or 0.0, timeout=None)
        cache.set(f"driver_rating_count:{driver_id}", stats['total_reviews'] or 0, timeout=None)
        
        logger.info(f"✅ Driver #{driver_id} rating recalculated: {stats['avg_rating']}★ across {stats['total_reviews']} reviews.")
        return f"Driver {driver_id} rating stats updated successfully."
    except User.DoesNotExist:
        logger.warning(f"⚠️ Driver #{driver_id} not found.")
        return f"Driver {driver_id} not found."

@shared_task
def auto_escalate_unresolved_disputes(order_id):
    """
    Checks if a raised dispute is still unresolved after 6 hours and auto-escalates to administrators.
    """
    from .models import Order
    from shops.models import Notification
    
    logger.info(f"⚖️ SLA Check: Checking dispute resolution status for Order #{order_id}...")
    try:
        order = Order.objects.get(id=order_id)
        if order.dispute_status == 'PENDING':
            logger.warning(f"🚨 SLA Violation: Order #{order_id} dispute remains PENDING for over 6 hours! Auto-escalating to administrators...")
            order.dispute_status = 'ESCALATED'
            order.save()
            
            # Notify disputed_by user
            if order.disputed_by:
                Notification.objects.create(
                    user=order.disputed_by,
                    title="🚨 تم تصعيد النزاع للإدارة",
                    message=f"تنبيه: نظراً لمرور 6 ساعات دون تسوية، تم تصعيد النزاع الخاص بالطلب #{order.id} تلقائياً لمراجعة الإدارة العليا للبت فيه.",
                    notification_type='dispute_escalated'
                )
            return f"Order {order_id} dispute successfully escalated to admin."
        else:
            logger.info(f"✅ Dispute for Order #{order_id} has status '{order.dispute_status}'. No escalation needed.")
            return f"Order {order_id} dispute status is {order.dispute_status}. No action taken."
    except Order.DoesNotExist:
        logger.warning(f"⚠️ Order #{order_id} not found.")
        return f"Order {order_id} not found."
