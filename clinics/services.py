from datetime import datetime, timedelta, date as date_type
from .models import Clinic, TimeSlot, MedicalService


def generate_slots_for_date(clinic, target_date):
    """
    Auto-generate time slots for a given date based on clinic hours and services.
    """
    if not clinic.opening_time or not clinic.closing_time:
        return

    services = clinic.services.filter(is_active=True)
    if not services.exists():
        return

    for service in services:
        current = datetime.combine(target_date, clinic.opening_time)
        end = datetime.combine(target_date, clinic.closing_time)

        while current + timedelta(minutes=service.duration_minutes) <= end:
            slot_end = current + timedelta(minutes=service.duration_minutes)

            existing = TimeSlot.objects.filter(
                clinic=clinic,
                date=target_date,
                start_time=current.time()
            ).first()
            if not existing:
                TimeSlot.objects.create(
                    clinic=clinic,
                    date=target_date,
                    start_time=current.time(),
                    end_time=slot_end.time(),
                    is_available=True,
                    is_auto_generated=True,
                    service=service
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
