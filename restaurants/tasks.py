from celery import shared_task
from django.utils import timezone
from .models import Restaurant, RestaurantNotification
import logging
from datetime import time
import zoneinfo

logger = logging.getLogger(__name__)


@shared_task
def check_restaurant_working_hours(simulated_time_str=None):
    if simulated_time_str:
        try:
            sim_h, sim_m = map(int, simulated_time_str.split(':'))
            now_time = time(sim_h, sim_m)
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

    try:
        cairo_tz = zoneinfo.ZoneInfo("Africa/Cairo")
        today = timezone.now().astimezone(cairo_tz).date()
    except Exception:
        today = timezone.localtime(timezone.now()).date()

    current_hour = now_time.hour
    current_minute = now_time.minute

    opening_restaurants = Restaurant.objects.filter(
        opening_time__hour=current_hour,
        opening_time__minute=current_minute
    )
    for restaurant in opening_restaurants:
        already_alerted = RestaurantNotification.objects.filter(
            restaurant=restaurant,
            notification_type='restaurant_open_alert',
            created_at__date=today
        ).exists()
        if not already_alerted:
            RestaurantNotification.objects.create(
                user=restaurant.owner,
                restaurant=restaurant,
                title="حان وقت فتح المطعم! \U0001f37d\ufe0f",
                message=f"يا غالي، الساعة دلوقتي {now_time.strftime('%H:%M')} ووفقاً لمواعيد عملك، حان وقت فتح مطعم '{restaurant.name}'. اضغط هنا لتعديل حالة المطعم واستقبال طلبات أهل قريتك!",
                notification_type='restaurant_open_alert'
            )

    closing_restaurants = Restaurant.objects.filter(
        closing_time__hour=current_hour,
        closing_time__minute=current_minute
    )
    for restaurant in closing_restaurants:
        already_alerted = RestaurantNotification.objects.filter(
            restaurant=restaurant,
            notification_type='restaurant_close_alert',
            created_at__date=today
        ).exists()
        if not already_alerted:
            RestaurantNotification.objects.create(
                user=restaurant.owner,
                restaurant=restaurant,
                title="حان وقت إغلاق المطعم! \U0001f512",
                message=f"يا غالي، الساعة دلوقتي {now_time.strftime('%H:%M')} ووفقاً لمواعيد عملك، حان وقت إغلاق مطعم '{restaurant.name}'. اضغط هنا لإغلاق المطعم لترتاح وتتوقف عن استقبال الطلبات مؤقتاً.",
                notification_type='restaurant_close_alert'
            )

    return "Restaurant hours checked successfully."
