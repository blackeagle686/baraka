from django.test import TestCase
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
