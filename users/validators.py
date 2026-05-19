import os
import re
from django.core.exceptions import ValidationError

def validate_egyptian_phone(value):
    """
    Validates and normalizes Egyptian mobile numbers.
    Accepted formats:
      - 01012345678 (11 digits)
      - 201012345678 (12 digits)
      - +201012345678 (13 characters)
    Allows carriers: Vodafone (010), Etisalat (011), Orange (012), WE (015).
    Normalizes all formats to the standard 11-digit local format: 01xxxxxxxxx.
    """
    if not value:
        raise ValidationError("رقم الهاتف مطلوب.")
        
    value_str = str(value).strip()
    
    # Precise Carrier Regular Expression:
    # Matches: (optional +20 or 20 or 0) followed by 10/11/12/15 followed by 8 digits
    pattern = r'^(\+?20|0)?(1[0125]\d{8})$'
    match = re.match(pattern, value_str)
    
    if not match:
        raise ValidationError(
            "رقم الهاتف غير صالح. يجب أن يكون رقم هاتف مصري صحيح (مثال: 01012345678)."
        )
    
    # Normalize to local 11-digit format starting with '0'
    core_number = match.group(2)
    normalized = f"0{core_number}"
    return normalized

def validate_strong_password(value):
    """
    Enforces strong password policy:
      - Minimum 8 characters.
      - At least one uppercase letter.
      - At least one lowercase letter.
      - At least one digit.
      - At least one special character.
    """
    if not value:
        raise ValidationError("كلمة المرور مطلوبة.")
        
    if len(value) < 8:
        raise ValidationError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.")
        
    if not re.search(r'[A-Z]', value):
        raise ValidationError("كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z).")
        
    if not re.search(r'[a-z]', value):
        raise ValidationError("كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل (a-z).")
        
    if not re.search(r'\d', value):
        raise ValidationError("كلمة المرور يجب أن تحتوي على رقم واحد على الأقل (0-9).")
        
    if not re.search(r'[!@#\$%\^&\*\(\)_\+\-=\[\]\{\}\|;\'\:",\./<>\?]', value):
        raise ValidationError("كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل (مثال: @, #, $, ...).")
        
    return value

def validate_secure_file(file):
    """
    Validates uploaded file for security criteria:
      - Maximum file size: 2MB (2,097,152 bytes)
      - Allowed extensions: .jpg, .jpeg, .png, .pdf
      - Allowed MIME types: image/jpeg, image/png, application/pdf
    """
    if not file:
        return file
        
    # 1. Check file size (2MB)
    max_size = 2 * 1024 * 1024
    if file.size > max_size:
        raise ValidationError("حجم الملف يجب ألا يتجاوز 2 ميجابايت.")
        
    # 2. Check file extension
    ext = os.path.splitext(file.name)[1].lower()
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.pdf']
    if ext not in allowed_extensions:
        raise ValidationError("صيغ الملفات المسموح بها هي فقط: JPG, PNG, PDF.")
        
    # 3. Check content type (MIME type)
    allowed_mime_types = ['image/jpeg', 'image/png', 'application/pdf']
    if file.content_type not in allowed_mime_types:
        raise ValidationError("نوع الملف غير مدعوم. يرجى رفع ملف صورة أو PDF صالح.")
        
    return file
