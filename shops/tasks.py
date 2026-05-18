from celery import shared_task
from django.utils import timezone
from .models import Shop, Notification
import logging
from datetime import datetime, time
import zoneinfo

logger = logging.getLogger(__name__)

@shared_task
def check_shop_working_hours(simulated_time_str=None):
    """
    Checks all shops to see if their opening or closing time has arrived.
    Sends notifications to their owners to open or close their shops.
    """
    # 1. Determine target local time
    if simulated_time_str:
        try:
            # Simulated time in HH:MM format
            sim_h, sim_m = map(int, simulated_time_str.split(':'))
            now_time = time(sim_h, sim_m)
            logger.info(f"[SIMULATION] Checking shop hours for simulated time: {now_time.strftime('%H:%M')}")
        except Exception as e:
            logger.error(f"[SIMULATION] Failed to parse simulated time '{simulated_time_str}': {e}")
            return "Failed: Invalid simulated time format."
    else:
        try:
            cairo_tz = zoneinfo.ZoneInfo("Africa/Cairo")
            now_local = timezone.now().astimezone(cairo_tz)
        except Exception:
            now_local = timezone.localtime(timezone.now())
        now_time = now_local.time()
        logger.info(f"Checking shop hours for local time: {now_time.strftime('%H:%M')}")

    # Use today's date in Cairo timezone for the deduplication check
    try:
        cairo_tz = zoneinfo.ZoneInfo("Africa/Cairo")
        today = timezone.now().astimezone(cairo_tz).date()
    except Exception:
        today = timezone.localtime(timezone.now()).date()

    current_hour = now_time.hour
    current_minute = now_time.minute

    # 2. Check Opening Hours
    opening_shops = Shop.objects.filter(
        opening_time__hour=current_hour,
        opening_time__minute=current_minute
    )
    for shop in opening_shops:
        # Check if they already have an open alert today
        already_alerted = Notification.objects.filter(
            shop=shop,
            notification_type='shop_open_alert',
            created_at__date=today
        ).exists()

        if not already_alerted:
            Notification.objects.create(
                user=shop.owner,
                shop=shop,
                title="حان وقت فتح المحل! 🏪",
                message=f"يا غالي، الساعة دلوقتي {now_time.strftime('%H:%M')} ووفقاً لمواعيد عملك، حان وقت فتح محل '{shop.name}'. اضغط هنا لتعديل حالة المحل واستقبال طلبات أهل قريتك!",
                notification_type='shop_open_alert'
            )
            logger.info(f"Sent shop_open_alert to owner of shop: {shop.name}")

    # 3. Check Closing Hours
    closing_shops = Shop.objects.filter(
        closing_time__hour=current_hour,
        closing_time__minute=current_minute
    )
    for shop in closing_shops:
        # Check if they already have a close alert today
        already_alerted = Notification.objects.filter(
            shop=shop,
            notification_type='shop_close_alert',
            created_at__date=today
        ).exists()

        if not already_alerted:
            Notification.objects.create(
                user=shop.owner,
                shop=shop,
                title="حان وقت إغلاق المحل! 🔒",
                message=f"يا غالي، الساعة دلوقتي {now_time.strftime('%H:%M')} ووفقاً لمواعيد عملك، حان وقت إغلاق محل '{shop.name}'. اضغط هنا لإغلاق المحل لترتاح وتتوقف عن استقبال الطلبات مؤقتاً.",
                notification_type='shop_close_alert'
            )
            logger.info(f"Sent shop_close_alert to owner of shop: {shop.name}")

    return "Shop hours checked successfully."
