document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

function checkAuth() {
    const token = localStorage.getItem('access_token');
    const authSection = document.getElementById('authSection');
    
    if (token) {
        // User is logged in
        authSection.innerHTML = `
            <a href="profile.html" class="btn btn-outline-mesa me-2 rounded-pill fw-bold">حسابي</a>
            <button onclick="logout()" class="btn btn-mesa rounded-pill fw-bold text-white" style="background-color: var(--color-mesa);">تسجيل خروج</button>
        `;
    } else {
        // User is not logged in
        authSection.innerHTML = `
            <a href="login.html" class="btn btn-outline-mesa me-2 rounded-pill fw-bold" style="color: var(--color-mesa); border-color: var(--color-mesa);">دخول</a>
            <a href="register.html" class="btn btn-primary rounded-pill fw-bold">حساب جديد</a>
        `;
    }
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.reload();
}
