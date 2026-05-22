from celery import shared_task
import logging
from .services import send_sms_otp

logger = logging.getLogger(__name__)

@shared_task
def async_send_sms_otp(phone_number, otp_code):
    """
    Asynchronously dispatches an SMS OTP in the background.
    This frees the main HTTP server thread from waiting for third-party network APIs!
    """
    logger.info(f"[/] Starting background async SMS dispatch to {phone_number}...")
    success = send_sms_otp(phone_number, otp_code)
    if success:
        logger.info(f"[+] Background async SMS dispatch to {phone_number} completed.")
        return f"OTP sent successfully to {phone_number}."
    else:
        logger.error(f"[-] Background async SMS dispatch to {phone_number} failed.")
        return f"Failed to send OTP to {phone_number}."
