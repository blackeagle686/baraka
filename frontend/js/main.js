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
function applyBarakaModalStyles(overlay) {
    overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(50, 4, 4, 0.45) !important;
        backdrop-filter: blur(12px) saturate(1.6) !important;
        -webkit-backdrop-filter: blur(12px) saturate(1.6) !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        z-index: 9999999 !important;
        opacity: 0 !important;
        transition: opacity 0.3s ease-out !important;
    `;
    
    const box = overlay.querySelector('.baraka-modal-box');
    if (box) {
        box.style.cssText = `
            background: rgba(255, 255, 255, 0.95) !important;
            border: 1px solid rgba(201, 153, 151, 0.25) !important;
            border-radius: 24px !important;
            width: 92% !important;
            max-width: 440px !important;
            padding: 2.2rem !important;
            text-align: center !important;
            box-shadow: 0 20px 60px rgba(50, 4, 4, 0.25) !important;
            transform: translateY(35px) scale(0.95) !important;
            transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            direction: rtl !important;
        `;
    }
    
    overlay.querySelectorAll('.baraka-modal-icon').forEach(icon => {
        icon.style.cssText = `
            width: 64px !important;
            height: 64px !important;
            border-radius: 50% !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            margin: 0 auto 1.2rem !important;
            font-size: 1.8rem !important;
        `;
        if (icon.classList.contains('warning')) {
            icon.style.background = 'rgba(201, 153, 151, 0.12)';
            icon.style.color = '#b8574c';
            icon.style.border = '1.5px solid rgba(201, 153, 151, 0.25)';
        } else {
            icon.style.background = 'rgba(194, 146, 64, 0.12)';
            icon.style.color = '#c29240';
            icon.style.border = '1.5px solid rgba(194, 146, 64, 0.25)';
        }
    });
    
    overlay.querySelectorAll('.baraka-modal-title').forEach(t => {
        t.style.cssText = `
            font-size: 1.3rem !important;
            font-weight: 700 !important;
            color: #320404 !important;
            margin-bottom: 0.6rem !important;
            font-family: 'Cairo', sans-serif !important;
        `;
    });
    
    overlay.querySelectorAll('.baraka-modal-text').forEach(t => {
        t.style.cssText = `
            font-size: 0.98rem !important;
            color: #5e2c38 !important;
            margin-bottom: 1.6rem !important;
            line-height: 1.6 !important;
            font-family: 'Cairo', sans-serif !important;
        `;
    });
    
    overlay.querySelectorAll('.baraka-modal-input-wrapper').forEach(w => {
        w.style.cssText = `margin-bottom: 1.6rem !important;`;
    });
    
    overlay.querySelectorAll('.baraka-modal-input').forEach(input => {
        input.style.cssText = `
            width: 100% !important;
            padding: 0.75rem 1.2rem !important;
            font-size: 1.1rem !important;
            text-align: center !important;
            font-weight: 700 !important;
            letter-spacing: 1px !important;
            border-radius: 100px !important;
            background: rgba(253, 245, 241, 0.9) !important;
            border: 1.5px solid rgba(201, 153, 151, 0.2) !important;
            font-family: 'Cairo', sans-serif !important;
        `;
    });
    
    overlay.querySelectorAll('.baraka-modal-footer').forEach(f => {
        f.style.cssText = `
            display: flex !important;
            gap: 0.8rem !important;
            justify-content: center !important;
        `;
    });
    
    overlay.querySelectorAll('.baraka-modal-btn').forEach(btn => {
        btn.style.cssText = `
            padding: 0.6rem 1.8rem !important;
            border-radius: 100px !important;
            font-size: 0.92rem !important;
            font-weight: 700 !important;
            min-width: 110px !important;
            font-family: 'Cairo', sans-serif !important;
        `;
    });
}

window.showBarakaAlert = function(message, type = 'info', title = 'تنبيه') {
    return new Promise((resolve) => {
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
        
        applyBarakaModalStyles(overlay);
        document.documentElement.appendChild(overlay);
        
        const box = overlay.querySelector('.baraka-modal-box');
        
        // Trigger active animations inline
        setTimeout(() => {
            overlay.style.opacity = '1';
            if (box) box.style.transform = 'translateY(0) scale(1)';
        }, 50);
        
        const closeAlert = () => {
            overlay.style.opacity = '0';
            if (box) box.style.transform = 'translateY(35px) scale(0.95)';
            setTimeout(() => {
                overlay.remove();
                resolve(true);
            }, 300);
        };
        
        document.getElementById('barakaAlertOkBtn').addEventListener('click', closeAlert);
        
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
        
        applyBarakaModalStyles(overlay);
        document.documentElement.appendChild(overlay);
        
        const input = document.getElementById('barakaPromptInput');
        const submitBtn = document.getElementById('barakaPromptSubmitBtn');
        const cancelBtn = document.getElementById('barakaPromptCancelBtn');
        const errorEl = document.getElementById('barakaPromptError');
        const box = overlay.querySelector('.baraka-modal-box');
        
        // Focus and trigger active animations
        setTimeout(() => {
            overlay.style.opacity = '1';
            if (box) box.style.transform = 'translateY(0) scale(1)';
            input.focus();
        }, 50);
        
        const closePrompt = (val) => {
            overlay.style.opacity = '0';
            if (box) box.style.transform = 'translateY(35px) scale(0.95)';
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
        
        input.addEventListener('input', () => {
            errorEl.classList.add('d-none');
            input.classList.remove('is-invalid');
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
    });
};
