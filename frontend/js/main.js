document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

function checkAuth() {
    const token = localStorage.getItem('access_token');
    const authSection = document.getElementById('authSection');
    
    // Determine path prefix based on whether we are in a subfolder
    const pathPrefix = window.location.pathname.includes('/html/') ? '../' : '';
    
    if (token) {
        authSection.innerHTML = `
            <a href="${pathPrefix}profile/user.html" class="btn btn-outline-mesa me-2 rounded-pill fw-bold">حسابي</a>
            <button onclick="logout()" class="btn btn-mesa rounded-pill fw-bold text-white" style="background-color: var(--color-mesa);">تسجيل خروج</button>
        `;
    } else {
        authSection.innerHTML = `
            <a href="${pathPrefix}auth/login.html" class="btn btn-outline-mesa me-2 rounded-pill fw-bold" style="color: var(--color-mesa); border-color: var(--color-mesa);">دخول</a>
            <a href="${pathPrefix}auth/register.html" class="btn btn-primary rounded-pill fw-bold">حساب جديد</a>
        `;
    }
}

window.logout = function() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.reload();
}
