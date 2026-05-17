document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('phone').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('loginBtn');
            const btnText = btn.querySelector('.btn-text');
            const spinner = btn.querySelector('.spinner-border');
            const errorMsg = document.getElementById('errorMsg');
            
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
                if (profile.role === 'DRIVER') {
                    window.location.href = '/html/profile/driver.html';
                } else if (profile.role === 'SHOP_OWNER') {
                    window.location.href = '/html/profile/shop.html';
                } else {
                    window.location.href = '/html/index.html';
                }
            } catch (error) {
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
            const name = document.getElementById('name').value;
            const phone = document.getElementById('phone').value;
            const location = document.getElementById('location').value;
            const role = document.getElementById('role').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('registerBtn');
            const btnText = btn.querySelector('.btn-text');
            const spinner = btn.querySelector('.spinner-border');
            const errorMsg = document.getElementById('errorMsg');
            
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
                
                if (profile.role === 'DRIVER') {
                    window.location.href = '/html/profile/driver.html';
                } else if (profile.role === 'SHOP_OWNER') {
                    window.location.href = '/html/profile/shop.html';
                } else {
                    window.location.href = '/html/index.html';
                }
            } catch (error) {
                errorMsg.innerText = "خطأ: " + JSON.stringify(error);
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
