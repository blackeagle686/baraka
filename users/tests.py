from django.test import TestCase, override_settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from users.validators import (
    validate_egyptian_phone,
    validate_strong_password,
    validate_secure_file
)

class SecurityValidatorsTestCase(TestCase):
    """
    Test suite for Baraka project security validators, covering Egyptian carrier 
    phone validation/normalization, password complexity policy, and 2MB file limits.
    """

    def test_validate_egyptian_phone_valid(self):
        # 1. Test Vodafone (010)
        self.assertEqual(validate_egyptian_phone("01012345678"), "01012345678")
        
        # 2. Test Etisalat (011)
        self.assertEqual(validate_egyptian_phone("01112345678"), "01112345678")
        
        # 3. Test Orange (012)
        self.assertEqual(validate_egyptian_phone("01212345678"), "01212345678")
        
        # 4. Test WE (015)
        self.assertEqual(validate_egyptian_phone("01512345678"), "01512345678")

    def test_validate_egyptian_phone_normalization(self):
        # Test international format with '+' prefix
        self.assertEqual(validate_egyptian_phone("+201012345678"), "01012345678")
        
        # Test international format without '+' prefix
        self.assertEqual(validate_egyptian_phone("201212345678"), "01212345678")

    def test_validate_egyptian_phone_invalid(self):
        # Invalid carrier prefix (013/014 are not valid)
        with self.assertRaises(ValidationError):
            validate_egyptian_phone("01312345678")
        with self.assertRaises(ValidationError):
            validate_egyptian_phone("01412345678")

        # Too short or too long
        with self.assertRaises(ValidationError):
            validate_egyptian_phone("010123")
        with self.assertRaises(ValidationError):
            validate_egyptian_phone("0101234567890")

        # Invalid characters or letters
        with self.assertRaises(ValidationError):
            validate_egyptian_phone("010abc45678")
        with self.assertRaises(ValidationError):
            validate_egyptian_phone("")

    def test_validate_strong_password_valid(self):
        # Valid strong password should return itself
        self.assertEqual(validate_strong_password("BarakaPartner2026!"), "BarakaPartner2026!")

    def test_validate_strong_password_invalid(self):
        # Too short (< 8 chars)
        with self.assertRaises(ValidationError):
            validate_strong_password("Bp26!")

        # Missing uppercase
        with self.assertRaises(ValidationError):
            validate_strong_password("barakapartner2026!")

        # Missing lowercase
        with self.assertRaises(ValidationError):
            validate_strong_password("BARAKAPARTNER2026!")

        # Missing digits
        with self.assertRaises(ValidationError):
            validate_strong_password("BarakaPartner!")

        # Missing special character
        with self.assertRaises(ValidationError):
            validate_strong_password("BarakaPartner2026")

    def test_validate_secure_file_valid(self):
        # Valid JPG image < 2MB
        valid_jpg = SimpleUploadedFile("avatar.jpg", b"dummy_content", content_type="image/jpeg")
        self.assertEqual(validate_secure_file(valid_jpg), valid_jpg)

        # Valid PNG image < 2MB
        valid_png = SimpleUploadedFile("logo.png", b"dummy_content", content_type="image/png")
        self.assertEqual(validate_secure_file(valid_png), valid_png)

        # Valid PDF document < 2MB
        valid_pdf = SimpleUploadedFile("cv.pdf", b"dummy_content", content_type="application/pdf")
        self.assertEqual(validate_secure_file(valid_pdf), valid_pdf)

    def test_validate_secure_file_too_large(self):
        # File > 2MB (2 * 1024 * 1024 + 1 bytes)
        large_bytes = b"0" * (2 * 1024 * 1024 + 1)
        large_file = SimpleUploadedFile("huge.png", large_bytes, content_type="image/png")
        with self.assertRaises(ValidationError):
            validate_secure_file(large_file)

    def test_validate_secure_file_invalid_extension(self):
        # Forbidden extension (e.g., executive .exe or .txt)
        malicious_file = SimpleUploadedFile("exploit.exe", b"dummy_content", content_type="image/png")
        with self.assertRaises(ValidationError):
            validate_secure_file(malicious_file)

    def test_validate_secure_file_invalid_mime(self):
        # Mismatched/unsupported MIME type (e.g., text/html)
        bad_mime_file = SimpleUploadedFile("normal.png", b"dummy_content", content_type="text/html")
        with self.assertRaises(ValidationError):
            validate_secure_file(bad_mime_file)


from rest_framework.test import APITestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from .models import PhoneOTP
from orders.models import Order
from rest_framework.throttling import SimpleRateThrottle

SimpleRateThrottle.THROTTLE_RATES = {
    'anon': '999999/day',
    'user': '999999/day',
    'auth': '999999/day',
    'chatbot': '999999/day',
}

User = get_user_model()

@override_settings(REST_FRAMEWORK={
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
})
class SMSOTPVerificationTestCase(APITestCase):
    """
    Integration tests for secure SMS OTP phone verification endpoints.
    Verifies generation, expiration limits, brute-force security blocks, and user activation.
    """

    def setUp(self):
        self.phone_number = "01012345678"
        self.user = User.objects.create_user(
            phone=self.phone_number,
            password="StrongPassword2026!",
            role="CUSTOMER"
        )
        self.send_url = reverse("send_otp")
        self.verify_url = reverse("verify_otp")

    def test_send_otp_success(self):
        response = self.client.post(self.send_url, {"phone": self.phone_number})
        self.assertEqual(response.status_code, 200)
        self.assertIn("تم إرسال رمز التحقق لهاتفك بنجاح في الخلفية.", response.data["detail"])
        
        # Verify PhoneOTP record exists in database
        otp_record = PhoneOTP.objects.get(phone=self.phone_number)
        self.assertEqual(len(otp_record.otp), 6)
        self.assertFalse(otp_record.is_verified)
        self.assertTrue(otp_record.otp.isdigit())

    def test_verify_otp_success(self):
        # Generate an active verification code
        otp_code = "123456"
        PhoneOTP.objects.create(
            phone=self.phone_number,
            otp=otp_code,
            expires_at=timezone.now() + timedelta(minutes=5),
            attempts=0
        )

        response = self.client.post(self.verify_url, {
            "phone": self.phone_number,
            "otp": otp_code
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_verified"])

        # Reload user and check activation state
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_phone_verified)

    def test_verify_otp_invalid_code(self):
        otp_code = "123456"
        PhoneOTP.objects.create(
            phone=self.phone_number,
            otp=otp_code,
            expires_at=timezone.now() + timedelta(minutes=5),
            attempts=0
        )

        response = self.client.post(self.verify_url, {
            "phone": self.phone_number,
            "otp": "999999" # Wrong code
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("رمز التحقق غير صحيح", response.data["detail"])

        # Verify attempt increment
        otp_record = PhoneOTP.objects.get(phone=self.phone_number)
        self.assertEqual(otp_record.attempts, 1)

    def test_verify_otp_brute_force_block(self):
        otp_code = "123456"
        PhoneOTP.objects.create(
            phone=self.phone_number,
            otp=otp_code,
            expires_at=timezone.now() + timedelta(minutes=5),
            attempts=5 # Maxed out attempts
        )

        response = self.client.post(self.verify_url, {
            "phone": self.phone_number,
            "otp": otp_code
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("تجاوزت الحد الأقصى للمحاولات", response.data["detail"])

    def test_verify_otp_expired(self):
        otp_code = "123456"
        PhoneOTP.objects.create(
            phone=self.phone_number,
            otp=otp_code,
            expires_at=timezone.now() - timedelta(seconds=1), # Expired 1 second ago
            attempts=0
        )

        response = self.client.post(self.verify_url, {
            "phone": self.phone_number,
            "otp": otp_code
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("منتهي الصلاحية", response.data["detail"])


@override_settings(REST_FRAMEWORK={
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
})
class CheckoutGateTestCase(APITestCase):
    """
    Verifies that unverified accounts cannot place orders (403 Forbidden),
    and verified accounts can place orders successfully.
    """

    def setUp(self):
        self.phone_number = "01012345678"
        self.user = User.objects.create_user(
            phone=self.phone_number,
            password="StrongPassword2026!",
            role="CUSTOMER",
            is_phone_verified=False # Start unverified
        )
        # Auth client
        self.client.force_authenticate(user=self.user)
        self.checkout_url = reverse("order-list")

    def test_checkout_unverified_user_blocked(self):
        payload = {
            "address": "Cairo, Egypt",
            "items": [{"product": 1, "quantity": 1}]
        }
        response = self.client.post(self.checkout_url, payload, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertIn("يرجى تفعيل حسابك", response.data["detail"])

    def test_checkout_verified_user_allowed(self):
        # Promote user to verified
        self.user.is_phone_verified = True
        self.user.save()

        # Create a mock product and shop
        from shops.models import Shop, Product
        shop_owner = User.objects.create_user(
            phone="01112345678", password="ShopOwnerPassword2026!", role="SHOP_OWNER"
        )
        shop = Shop.objects.create(name="Test Shop", owner=shop_owner, is_open=True)
        product = Product.objects.create(
            name="Mock Item", price=100.0, quantity=10, available=True, shop=shop
        )

        payload = {
            "address": "Cairo, Egypt",
            "items": [{"product": product.id, "quantity": 2}]
        }
        response = self.client.post(self.checkout_url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(float(response.data["total_price"]), 200.0)


@override_settings(REST_FRAMEWORK={
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
})
class DriverApprovalTestCase(APITestCase):
    """
    Verifies driver is_approved behavior: unapproved drivers cannot accept
    deliveries, while approved drivers can successfully perform driver actions.
    """

    def setUp(self):
        # Create users
        self.customer = User.objects.create_user(
            phone="01011111111", password="CustomerPassword2026!", role="CUSTOMER", is_phone_verified=True
        )
        self.shop_owner = User.objects.create_user(
            phone="01022222222", password="ShopOwnerPassword2026!", role="SHOP_OWNER", is_phone_verified=True
        )
        self.driver = User.objects.create_user(
            phone="01033333333", password="DriverPassword2026!", role="DRIVER", is_phone_verified=True
        )

        from shops.models import Shop, Product
        self.shop = Shop.objects.create(name="Approval Test Shop", owner=self.shop_owner, is_open=True)
        self.product = Product.objects.create(
            name="Approval Item", price=50.0, quantity=5, available=True, shop=self.shop
        )

        # Place order
        self.order = Order.objects.create(
            customer=self.customer,
            shop=self.shop,
            status="PENDING",
            address="Test Address",
            total_price=50.0
        )
        # Create OrderItem
        from orders.models import OrderItem
        OrderItem.objects.create(order=self.order, product=self.product, quantity=1, price=50.0)

        # URLs
        self.accept_url = reverse("order-accept-delivery", kwargs={"pk": self.order.id})

    def test_new_driver_unapproved_by_default(self):
        # Newly registered driver serializer sets Needs Approval
        response = self.client.post(reverse("register"), {
            "phone": "01044444444",
            "password": "NewDriverPassword2026!",
            "name": "New Driver",
            "role": "DRIVER"
        })
        self.assertEqual(response.status_code, 201)
        
        # Verify approval is False
        new_driver = User.objects.get(phone="01044444444")
        self.assertFalse(new_driver.is_approved)

    def test_unapproved_driver_accept_delivery_blocked(self):
        # Force authentication of unapproved driver
        self.driver.is_approved = False
        self.driver.save()
        self.client.force_authenticate(user=self.driver)

        response = self.client.post(self.accept_url, {"delivery_price": 20.0})
        self.assertEqual(response.status_code, 403)
        self.assertIn("حسابك قيد المراجعة", response.data["detail"])

    def test_approved_driver_accept_delivery_allowed(self):
        # Approve driver
        self.driver.is_approved = True
        self.driver.save()
        self.client.force_authenticate(user=self.driver)

        response = self.client.post(self.accept_url, {"delivery_price": 15.00})
        self.assertEqual(response.status_code, 200)
        
        # Reload order
        self.order.refresh_from_db()
        self.assertEqual(self.order.driver, self.driver)
        self.assertEqual(self.order.status, "ON_DELIVERY")


@override_settings(REST_FRAMEWORK={
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
})
class PasswordResetTestCase(APITestCase):
    """
    Test suite for request OTP forgot password and confirming reset password flow.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            phone="01012345678",
            password="OldPassword2026!",
            role="CUSTOMER",
            is_phone_verified=True
        )
        self.request_url = reverse("password_reset_request")
        self.confirm_url = reverse("password_reset_confirm")

    def test_request_reset_nonexistent_phone(self):
        response = self.client.post(self.request_url, {"phone": "01099999999"})
        self.assertEqual(response.status_code, 404)
        self.assertIn("هذا الرقم غير مسجل لدينا", response.data["detail"])

    def test_request_reset_invalid_phone(self):
        response = self.client.post(self.request_url, {"phone": "123456"})
        self.assertEqual(response.status_code, 400)

    def test_request_reset_success_creates_otp(self):
        response = self.client.post(self.request_url, {"phone": "01012345678"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(PhoneOTP.objects.filter(phone="01012345678").exists())

    def test_confirm_reset_invalid_otp(self):
        # Create OTP
        PhoneOTP.objects.create(
            phone="01012345678",
            otp="123456",
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        response = self.client.post(self.confirm_url, {
            "phone": "01012345678",
            "otp": "654321",
            "new_password": "NewSecurePassword2026!"
        })
        self.assertEqual(response.status_code, 400)

    def test_confirm_reset_weak_password(self):
        PhoneOTP.objects.create(
            phone="01012345678",
            otp="123456",
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        response = self.client.post(self.confirm_url, {
            "phone": "01012345678",
            "otp": "123456",
            "new_password": "weak"
        })
        self.assertEqual(response.status_code, 400)

    def test_confirm_reset_success(self):
        PhoneOTP.objects.create(
            phone="01012345678",
            otp="123456",
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        response = self.client.post(self.confirm_url, {
            "phone": "01012345678",
            "otp": "123456",
            "new_password": "NewSecurePassword2026!"
        })
        self.assertEqual(response.status_code, 200)
        
        # Verify password is changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecurePassword2026!"))



