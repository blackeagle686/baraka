document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

function checkAuth() {
    const token = localStorage.getItem('access_token');
    const authSection = document.getElementById('authSection');
    if (!authSection) return;
    
    const userRole = localStorage.getItem('user_role');
    
    if (token) {
        let manageShopHtml = '';
        if (userRole === 'SHOP_OWNER') {
            manageShopHtml = `<a href="/html/profile/shop.html" class="btn btn-marigold rounded-pill fw-bold text-white btn-sm"><i class="bi bi-shop-window me-1"></i>إدارة محلي</a>`;
        }
        
        authSection.innerHTML = `
            ${manageShopHtml}
            <a href="/html/profile/user.html" class="btn btn-outline-mesa rounded-pill fw-bold btn-sm"><i class="bi bi-person me-1"></i>حسابي</a>
            <button onclick="logout()" class="btn rounded-pill fw-bold text-white btn-sm" style="background-color: var(--color-mesa);"><i class="bi bi-box-arrow-right me-1"></i>خروج</button>
        `;
    } else {
        authSection.innerHTML = `
            <a href="/html/auth/login.html" class="btn btn-outline-mesa rounded-pill fw-bold btn-sm"><i class="bi bi-box-arrow-in-left me-1"></i>دخول</a>
            <a href="/html/auth/register.html" class="btn btn-primary rounded-pill fw-bold btn-sm"><i class="bi bi-person-plus me-1"></i>حساب جديد</a>
        `;
    }
}

window.logout = function() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    window.location.reload();
}
