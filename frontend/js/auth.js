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
            
            try {
                await api.auth.register({ name, phone, location, role, password });
                
                // Premium Auto-Login after Registration
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
                let displayError = 'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.';
                if (error && error.phone) {
                    displayError = 'هذا الرقم مسجل بالفعل في النظام.';
                } else if (error && error.detail) {
                    displayError = error.detail;
                }
                
                errorMsg.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${displayError}`;
                errorMsg.classList.remove('d-none');
                
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
