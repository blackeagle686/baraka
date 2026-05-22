from datetime import datetime, timedelta, date as date_type
from .models import Clinic, TimeSlot, MedicalService


DEFAULT_SLOT_DURATION = 30  # minutes


def generate_slots_for_date(clinic, target_date):
    """
    Auto-generate time slots for a given date based on clinic hours.
    Uses the smallest active service duration as the slot interval.
    Slots are created without a specific service FK so the unique_together
    constraint (clinic, date, start_time) does not cause conflicts.
    """
    if not clinic.opening_time or not clinic.closing_time:
        return

    services = clinic.services.filter(is_active=True)
    if not services.exists():
        return

    # Use the smallest duration among active services as the slot pitch
    min_duration = min(s.duration_minutes for s in services)
    slot_duration = max(min_duration, DEFAULT_SLOT_DURATION)

    current = datetime.combine(target_date, clinic.opening_time)
    end = datetime.combine(target_date, clinic.closing_time)

    while current + timedelta(minutes=slot_duration) <= end:
        slot_end = current + timedelta(minutes=slot_duration)

        _, created = TimeSlot.objects.get_or_create(
            clinic=clinic,
            date=target_date,
            start_time=current.time(),
            defaults={
                'end_time': slot_end.time(),
                'is_available': True,
                'is_auto_generated': True,
            }
        )
        current = slot_end


def generate_slots_for_date_range(clinic, start_date, end_date):
    """
    Generate slots for a range of dates.
    """
    current_date = start_date
    while current_date <= end_date:
        generate_slots_for_date(clinic, current_date)
        current_date += timedelta(days=1)
