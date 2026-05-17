document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    renderFooter();
    checkAuth();
});

function renderHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    const path = window.location.pathname;
    const isIndexActive = path.endsWith('/index.html') || path.endsWith('/html/') ? 'active' : '';
    const isShopsActive = path.includes('/shops/') ? 'active' : '';

    headerPlaceholder.innerHTML = `
    <nav class="navbar navbar-expand-lg glass-nav fixed-top">
        <div class="container">
            <a class="navbar-brand fw-bold" href="/html/index.html">بركة</a>
            <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav me-auto">
                    <li class="nav-item"><a class="nav-link ${isIndexActive}" href="/html/index.html">الرئيسية</a></li>
                    <li class="nav-item"><a class="nav-link ${isShopsActive}" href="/html/shops/list.html">المحلات</a></li>
                </ul>
                <div class="d-flex auth-buttons gap-2" id="authSection"></div>
            </div>
        </div>
    </nav>
    `;
}

function renderFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;

    footerPlaceholder.innerHTML = `
    <footer class="app-footer">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-md-6 text-center text-md-start mb-3 mb-md-0">
                    <span class="footer-brand">بركة</span>
                    <p class="mb-0 mt-1 small">أسرع خدمة توصيل في قريتك</p>
                </div>
                <div class="col-md-6 text-center text-md-end">
                    <p class="mb-0 small">© 2026 بركة. جميع الحقوق محفوظة.</p>
                </div>
            </div>
        </div>
    </footer>
    `;
}

function checkAuth() {
    const token = localStorage.getItem('access_token');
    const authSection = document.getElementById('authSection');
    if (!authSection) return;
    
    const userRole = localStorage.getItem('user_role');
    
    if (token) {
        let manageShopHtml = '';
        if (userRole === 'SHOP_OWNER') {
            manageShopHtml = `<a href="/html/profile/shop.html" class="btn btn-marigold rounded-pill fw-bold text-white btn-sm"><i class="bi bi-shop-window me-1"></i>إدارة محلي</a>`;
        } else if (userRole === 'DRIVER') {
            manageShopHtml = `<a href="/html/profile/driver.html" class="btn btn-success rounded-pill fw-bold text-white btn-sm"><i class="bi bi-bicycle me-1"></i>لوحة الطيار</a>`;
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

// ==========================================
// Baraka Premium Custom Alert & Prompt Modals
// ==========================================
window.showBarakaAlert = function(message, type = 'info', title = 'تنبيه') {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'baraka-modal-overlay';
        
        const iconHtml = type === 'warning' 
            ? `<div class="baraka-modal-icon warning"><i class="bi bi-exclamation-triangle-fill"></i></div>`
            : `<div class="baraka-modal-icon info"><i class="bi bi-info-circle-fill"></i></div>`;
            
        overlay.innerHTML = `
            <div class="baraka-modal-box">
                ${iconHtml}
                <div class="baraka-modal-title">${title}</div>
                <div class="baraka-modal-text">${message}</div>
                <div class="baraka-modal-footer">
                    <button class="btn btn-primary baraka-modal-btn px-4" id="barakaAlertOkBtn">موافق</button>
                </div>
            </div>
        `;
        
        document.documentElement.appendChild(overlay);
        
        // Trigger active animations
        setTimeout(() => overlay.classList.add('active'), 50);
        
        const closeAlert = () => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                resolve(true);
            }, 300);
        };
        
        document.getElementById('barakaAlertOkBtn').addEventListener('click', closeAlert);
        
        // Keyboard support (Enter closes alert)
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                closeAlert();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    });
};

window.showBarakaPrompt = function(message, placeholder = '', title = 'إدخال مطلوب', isRequired = true) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'baraka-modal-overlay';
        
        overlay.innerHTML = `
            <div class="baraka-modal-box">
                <div class="baraka-modal-icon info"><i class="bi bi-shield-lock-fill"></i></div>
                <div class="baraka-modal-title">${title}</div>
                <div class="baraka-modal-text">${message}</div>
                <div class="baraka-modal-input-wrapper">
                    <input type="text" class="form-control baraka-modal-input" id="barakaPromptInput" placeholder="${placeholder}" autocomplete="off">
                    <div class="text-danger small mt-1 d-none" id="barakaPromptError">هذا الحقل مطلوب!</div>
                </div>
                <div class="baraka-modal-footer">
                    <button class="btn btn-primary baraka-modal-btn" id="barakaPromptSubmitBtn">تأكيد</button>
                    <button class="btn btn-outline-mesa baraka-modal-btn" id="barakaPromptCancelBtn">إلغاء</button>
                </div>
            </div>
        `;
        
        document.documentElement.appendChild(overlay);
        
        const input = document.getElementById('barakaPromptInput');
        const submitBtn = document.getElementById('barakaPromptSubmitBtn');
        const cancelBtn = document.getElementById('barakaPromptCancelBtn');
        const errorEl = document.getElementById('barakaPromptError');
        
        // Focus input immediately
        setTimeout(() => {
            overlay.classList.add('active');
            input.focus();
        }, 50);
        
        const closePrompt = (val) => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                resolve(val);
            }, 300);
        };
        
        submitBtn.addEventListener('click', () => {
            const val = input.value.trim();
            if (isRequired && !val) {
                errorEl.classList.remove('d-none');
                input.classList.add('is-invalid');
                return;
            }
            closePrompt(val);
        });
        
        cancelBtn.addEventListener('click', () => {
            closePrompt(null);
        });
        
        // Handle input events to clear errors
        input.addEventListener('input', () => {
            errorEl.classList.add('d-none');
            input.classList.remove('is-invalid');
        });
        
        // Keyboard support
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
    });
};
