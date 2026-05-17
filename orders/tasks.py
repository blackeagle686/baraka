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
