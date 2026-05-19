document.addEventListener('DOMContentLoaded', () => {
    // If user is already logged in, redirect them to their respective dashboard or home page
    const token = localStorage.getItem('access_token');
    if (token) {
        const role = localStorage.getItem('user_role');
        if (role === 'ADMIN') {
            window.location.href = '/html/admin/dashboard.html';
        } else if (role === 'DRIVER') {
            window.location.href = '/html/profile/driver.html';
        } else if (role === 'SHOP_OWNER') {
            window.location.href = '/html/profile/shop.html';
        } else {
            window.location.href = '/html/index.html';
        }
        return; // Stop further execution
    }

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('loginPhone').value;
            const password = document.getElementById('loginPassword').value;
            const btn = document.getElementById('loginBtn');
            const btnText = btn.querySelector('.btn-text');
            const spinner = btn.querySelector('.spinner-border');
            const errorMsg = document.getElementById('loginErrorMsg');
            
            // Set loading state
            btn.disabled = true;
            btnText.classList.add('invisible');
            spinner.classList.remove('d-none');
            errorMsg.classList.add('d-none');
            errorMsg.classList.remove('d-block');
            errorMsg.style.display = 'none';
            
            try {
                const data = await api.auth.login(phone, password);
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);
                
                // Fetch user profile to get the role
                const profile = await api.auth.getProfile(data.access);
                localStorage.setItem('user_role', profile.role);
                localStorage.setItem('user_name', profile.name || 'مستخدم بركة');
                
                // Role-based smart routing for best UX
                if (profile.role === 'ADMIN') {
                    window.location.href = '/html/admin/dashboard.html';
                } else if (profile.role === 'DRIVER') {
                    window.location.href = '/html/profile/driver.html';
                } else if (profile.role === 'SHOP_OWNER') {
                    window.location.href = '/html/profile/shop.html';
                } else {
                    window.location.href = '/html/index.html';
                }
            } catch (error) {
                let displayError = 'بيانات الدخول غير صحيحة أو الحساب محظور.';
                if (error && error.detail) {
                    displayError = 'بيانات الدخول غير صحيحة.'; // simplejwt default
                }
                errorMsg.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${displayError}`;
                errorMsg.classList.remove('d-none');
                errorMsg.classList.add('d-block');
                errorMsg.style.setProperty('display', 'block', 'important');
                errorMsg.style.opacity = '1';
                
                // Shake animation
                const card = document.querySelector('.auth-card');
                card.classList.remove('shake');
                void card.offsetWidth; // trigger reflow
                card.classList.add('shake');
                
                console.error("Login failed:", error);
            } finally {
                // Reset loading state
                btn.disabled = false;
                btnText.classList.remove('invisible');
                spinner.classList.add('d-none');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const phone = document.getElementById('regPhone').value;
            const location = document.getElementById('regLocation').value;
            const role = document.getElementById('regRole').value;
            const password = document.getElementById('regPassword').value;
            const btn = document.getElementById('registerBtn');
            const btnText = btn.querySelector('.btn-text');
            const spinner = btn.querySelector('.spinner-border');
            const errorMsg = document.getElementById('regErrorMsg');
            
            // Set loading state
            btn.disabled = true;
            btnText.classList.add('invisible');
            spinner.classList.remove('d-none');
            errorMsg.classList.add('d-none');
            errorMsg.classList.remove('d-block');
            errorMsg.style.display = 'none';

            // Egyptian Phone regex validator
            const phoneRegex = /^(01[0125]\d{8}|201[0125]\d{8}|\+201[0125]\d{8})$/;
            if (!phoneRegex.test(phone.trim())) {
                errorMsg.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>رقم الهاتف غير صالح. يرجى إدخال رقم مصري صحيح (مثال: 01012345678).`;
                errorMsg.classList.remove('d-none');
                errorMsg.classList.add('d-block');
                errorMsg.style.setProperty('display', 'block', 'important');
                errorMsg.style.opacity = '1';
                btn.disabled = false;
                btnText.classList.remove('invisible');
                spinner.classList.add('d-none');
                
                const card = document.querySelector('.auth-card');
                card.classList.remove('shake');
                void card.offsetWidth;
                card.classList.add('shake');
                return;
            }

            // Strong Password complexity validator
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#\$%\^&\*\(\)_\+\-=\[\]\{\}\|;\'\:",\./<>\?]).{8,}$/;
            if (!passwordRegex.test(password)) {
                errorMsg.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>كلمة المرور ضعيفة. يجب أن تحتوي على 8 أحرف على الأقل، تشمل حرفاً كبيراً، وحرفاً صغيراً، ورقماً، ورمزاً خاصاً.`;
                errorMsg.classList.remove('d-none');
                errorMsg.classList.add('d-block');
                errorMsg.style.setProperty('display', 'block', 'important');
                errorMsg.style.opacity = '1';
                btn.disabled = false;
                btnText.classList.remove('invisible');
                spinner.classList.add('d-none');
                
                const card = document.querySelector('.auth-card');
                card.classList.remove('shake');
                void card.offsetWidth;
                card.classList.add('shake');
                return;
            }
            
            try {
                await api.auth.register({ name, phone, location, role, password });
                
                // Trigger background SMS OTP send
                try {
                    await api.auth.sendOtp(phone);
                } catch (e) {
                    console.error("Initial OTP send failed:", e);
                }
                
                // Store registration data temporarily to auto-login after OTP verification
                window.tempRegPhone = phone;
                window.tempRegPassword = password;
                window.tempRegName = name;

                // Shift UI state to OTP mode
                document.getElementById('otpTargetPhone').innerText = phone;
                document.getElementById('otpFormWrapper').style.display = 'block';
                const card = document.getElementById('authCard');
                card.classList.remove('mode-register');
                card.classList.add('mode-otp');
                document.getElementById('authSubtitle').innerText = 'أدخل رمز التحقق لتفعيل حسابك الجديد';
                
            } catch (error) {
                let displayError = 'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.';
                if (error && error.phone) {
                    displayError = 'هذا الرقم مسجل بالفعل في النظام.';
                } else if (error && error.detail) {
                    displayError = error.detail;
                }
                
                errorMsg.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${displayError}`;
                errorMsg.classList.remove('d-none');
                errorMsg.classList.add('d-block');
                errorMsg.style.setProperty('display', 'block', 'important');
                errorMsg.style.opacity = '1';
                
                // Shake animation
                const card = document.querySelector('.auth-card');
                card.classList.remove('shake');
                void card.offsetWidth; // trigger reflow
                card.classList.add('shake');
                
                console.error("Registration failed:", error);
            } finally {
                // Reset loading state
                btn.disabled = false;
                btnText.classList.remove('invisible');
                spinner.classList.add('d-none');
            }
        });
    }

    // OTP Verification Submit Listener
    const otpForm = document.getElementById('otpForm');
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpCode = document.getElementById('otpCode').value.trim();
            const phone = window.tempRegPhone;
            const password = window.tempRegPassword;
            const name = window.tempRegName;

            const btn = document.getElementById('verifyOtpBtn');
            const btnText = btn.querySelector('.btn-text');
            const spinner = btn.querySelector('.spinner-border');
            const errorMsg = document.getElementById('otpErrorMsg');

            if (!phone || !password) {
                errorMsg.innerText = "خطأ في الجلسة. يرجى إعادة تحميل الصفحة والمحاولة مجدداً.";
                errorMsg.classList.remove('d-none');
                return;
            }

            // Set loading state
            btn.disabled = true;
            btnText.classList.add('invisible');
            spinner.classList.remove('d-none');
            errorMsg.classList.add('d-none');

            try {
                // Verify OTP with backend
                await api.auth.verifyOtp(phone, otpCode);

                // Auto-login after successful verification
                const data = await api.auth.login(phone, password);
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);
                
                const profile = await api.auth.getProfile(data.access);
                localStorage.setItem('user_role', profile.role);
                localStorage.setItem('user_name', profile.name || name || 'مستخدم بركة');
                
                if (profile.role === 'ADMIN') {
                    window.location.href = '/html/admin/dashboard.html';
                } else if (profile.role === 'DRIVER') {
                    window.location.href = '/html/profile/driver.html';
                } else if (profile.role === 'SHOP_OWNER') {
                    window.location.href = '/html/profile/shop.html';
                } else {
                    window.location.href = '/html/index.html';
                }
            } catch (error) {
                let displayError = 'رمز التحقق غير صحيح أو منتهي الصلاحية.';
                if (error && error.detail) {
                    displayError = error.detail;
                }
                errorMsg.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${displayError}`;
                errorMsg.classList.remove('d-none');
                
                // Shake animation on error
                const card = document.getElementById('authCard');
                card.classList.remove('shake');
                void card.offsetWidth;
                card.classList.add('shake');
            } finally {
                btn.disabled = false;
                btnText.classList.remove('invisible');
                spinner.classList.add('d-none');
            }
        });
    }

    // OTP Resend Button Event Listener
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', async () => {
            const phone = window.tempRegPhone;
            if (!phone) return;

            // Start 30s countdown to prevent resend spamming
            resendOtpBtn.disabled = true;
            let seconds = 30;
            const originalText = resendOtpBtn.innerText;
            
            const timer = setInterval(() => {
                seconds--;
                if (seconds <= 0) {
                    clearInterval(timer);
                    resendOtpBtn.disabled = false;
                    resendOtpBtn.innerText = originalText;
                } else {
                    resendOtpBtn.innerText = `إعادة إرسال خلال (${seconds} ثانية)`;
                }
            }, 1000);

            try {
                await api.auth.sendOtp(phone);
            } catch (e) {
                console.error("Resend OTP failed:", e);
                const errorMsg = document.getElementById('otpErrorMsg');
                errorMsg.innerText = e.detail || "فشل إرسال رمز التحقق. يرجى المحاولة لاحقاً.";
                errorMsg.classList.remove('d-none');
            }
        });
    }
});

// Password visibility toggle
window.togglePassword = function(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
};
