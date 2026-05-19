import os
import logging

logger = logging.getLogger(__name__)

def send_sms_otp(phone_number: str, otp_code: str) -> bool:
    """
    Modular dispatch service to send a 6-digit verification code to an Egyptian phone number.
    By default, it acts as a high-visibility console simulator for local testing.
    To use a real gateway, populate the environment credentials in your .env file!
    """
    logger.info(f"📱 [SMS GATEWAY DISPATCH] sending OTP code [{otp_code}] to Egyptian subscriber: {phone_number}")

    # Console output for quick local developer verification
    print("\n" + "="*80)
    print(f" 🔥  [SMS GATEWAY SIMULATOR]  🔥")
    print(f" Recipient Phone Number: {phone_number}")
    print(f" Verification OTP Code:  {otp_code}")
    print(f" Message: 'رمز التحقق الخاص بك لمنصة بركة هو: {otp_code}. صالح لمدة 5 دقائق.'")
    print("="*80 + "\n")

    # Real Twilio/SMSMisr Integration Example (to activate, add these variables in your .env):
    # sms_provider = os.getenv("SMS_PROVIDER", "console")
    # if sms_provider == "twilio":
    #     from twilio.rest import Client
    #     client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
    #     client.messages.create(
    #         body=f"رمز التحقق لمنصة بركة هو: {otp_code}",
    #         to=phone_number,
    #         from_=os.getenv("TWILIO_PHONE_NUMBER")
    #     )
    
    return True
