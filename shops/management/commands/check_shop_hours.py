from django.core.management.base import BaseCommand
from shops.tasks import check_shop_working_hours

class Command(BaseCommand):
    help = "Checks shop working hours and triggers opening/closing alerts."

    def add_arguments(self, parser):
        parser.add_argument(
            '--simulate-time',
            type=str,
            help="Simulate a specific local time in HH:MM format (e.g. 08:30 or 21:00) to test reminders."
        )

    def handle(self, *args, **options):
        sim_time = options.get('simulate_time')
        
        self.stdout.write(f"Executing working hour checker task...")
        result = check_shop_working_hours(simulated_time_str=sim_time)
        
        if "Failed" in result:
            self.stdout.write(self.style.ERROR(result))
        else:
            self.stdout.write(self.style.SUCCESS(f"Task completed successfully! Status: {result}"))
