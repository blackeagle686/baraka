document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('phone').value;
            const password = document.getElementById('password').value;
            
            try {
                const data = await api.auth.login(phone, password);
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);
                
                // Fetch user profile to get the role
                const profile = await api.auth.getProfile(data.access);
                localStorage.setItem('user_role', profile.role);
                
                window.location.href = '/html/index.html';
            } catch (error) {
                document.getElementById('errorMsg').classList.remove('d-none');
                console.error("Login failed:", error);
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
            
            try {
                await api.auth.register({ name, phone, location, role, password });
                window.location.href = '/html/auth/login.html';
            } catch (error) {
                const errorMsg = document.getElementById('errorMsg');
                errorMsg.innerText = "خطأ: " + JSON.stringify(error);
                errorMsg.classList.remove('d-none');
                console.error("Registration failed:", error);
            }
        });
    }
});
