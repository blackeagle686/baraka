document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    renderFooter();
    checkAuth();
});

function renderHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    const token = localStorage.getItem('access_token');
    const userRole = localStorage.getItem('user_role');
    const userName = localStorage.getItem('user_name') || 'مستخدم بركة';

    let rightSideHtml = '';
    const isCustomerOrGuest = !userRole || userRole === 'CUSTOMER';

    if (isCustomerOrGuest) {
        // Always include Explore / لف في المحلات
        rightSideHtml += `
            <a class="nav-link d-flex align-items-center gap-2 fw-bold text-espresso me-3" href="/html/shops/list.html" style="font-size: 0.95rem; color: var(--color-espresso) !important;">
                <i class="bi bi-compass fs-5 text-mesa"></i>
                <span>لف في المحلات</span>
            </a>
        `;

        // Always include Cart Icon with badge
        rightSideHtml += `
            <a class="nav-link d-flex align-items-center position-relative me-4" href="/html/cart.html" id="headerCartBtn" style="cursor: pointer; padding: 0.5rem;">
                <i class="bi bi-cart3 fs-4 text-espresso"></i>
                <span class="badge bg-success rounded-circle position-absolute top-0 start-100 translate-middle-y" id="headerCartCount" style="font-size: 0.65rem; padding: 0.25em 0.5em; min-width: 1.5em; display: none;">0</span>
            </a>
        `;
    }

    if (token) {
        let roleBadge = '';
        let profileLink = '/html/profile/user.html';

        if (userRole === 'SHOP_OWNER') {
            roleBadge = `<a href="/html/profile/shop.html" class="btn btn-marigold btn-sm rounded-pill fw-bold text-white px-3 py-1 me-2" style="font-size: 0.8rem;"><i class="bi bi-shop-window me-1"></i>إدارة محلي</a>`;
        } else if (userRole === 'DRIVER') {
            roleBadge = `<a href="/html/profile/driver.html" class="btn btn-success btn-sm rounded-pill fw-bold text-white px-3 py-1 me-2" style="font-size: 0.8rem;"><i class="bi bi-bicycle me-1"></i>لوحة الطيار</a>`;
        } else if (userRole === 'ADMIN') {
            roleBadge = `<a href="/html/admin/dashboard.html" class="btn btn-danger btn-sm rounded-pill fw-bold text-white px-3 py-1 me-2" style="font-size: 0.8rem;"><i class="bi bi-shield-lock me-1"></i>لوحة التحكم</a>`;
            profileLink = '/html/admin/dashboard.html';
        }

        rightSideHtml += `
            <div class="d-flex align-items-center gap-2">
                ${roleBadge}
                <div class="vr mx-2 text-muted opacity-25 d-none d-lg-block"></div>
                <a href="${profileLink}" class="nav-link d-flex align-items-center gap-2 fw-bold text-espresso me-2" style="font-size: 0.95rem; color: var(--color-espresso) !important;">
                    <i class="bi bi-person fs-5 text-mesa"></i>
                    <span>${userName}</span>
                </a>
                <button onclick="logout()" class="btn btn-link text-mesa p-1 text-decoration-none d-flex align-items-center justify-content-center" title="خروج" style="cursor: pointer; border: none; background: none;">
                    <i class="bi bi-box-arrow-right fs-4"></i>
                </button>
            </div>
        `;
    } else {
        rightSideHtml += `
            <div class="d-flex align-items-center gap-2">
                <a href="/html/auth/login.html" class="btn btn-outline-mesa rounded-pill btn-sm fw-bold px-3 py-1.5"><i class="bi bi-box-arrow-in-left me-1"></i>دخول</a>
                <a href="/html/auth/register.html" class="btn btn-primary rounded-pill btn-sm fw-bold px-3 py-1.5"><i class="bi bi-person-plus me-1"></i>حساب جديد</a>
            </div>
        `;
    }

    headerPlaceholder.innerHTML = `
    <nav class="navbar navbar-expand-lg glass-nav fixed-top shadow-sm py-2" style="direction: rtl;">
        <div class="container">
            <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="/html/index.html" style="font-size: 1.5rem; text-decoration: none;">
                <div class="d-flex align-items-center justify-content-center rounded-circle shadow-sm" style="width: 36px; height: 36px; background: linear-gradient(135deg, var(--color-marigold), var(--color-bronze)); color: white;">
                    <i class="bi bi-gem fs-6"></i>
                </div>
                <span style="background: linear-gradient(135deg, var(--color-espresso), var(--color-mesa)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 1px; font-weight: 900; font-family: 'Inter', sans-serif;">BARAKA</span>
            </a>
            <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <div class="d-flex align-items-center ms-auto gap-1 py-2 py-lg-0 w-100 justify-content-end navbar-nav-right">
                    ${rightSideHtml}
                </div>
            </div>
        </div>
    </nav>
    `;
}

function renderFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;

    footerPlaceholder.innerHTML = `
    <footer class="mt-auto" style="background: linear-gradient(to top, var(--color-espresso) 0%, #461414 100%); color: var(--color-dune-light); direction: rtl; border-top: 4px solid var(--color-marigold); position: relative; overflow: hidden;">
        <!-- Decorative Glow -->
        <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: var(--color-marigold); filter: blur(80px); opacity: 0.2; border-radius: 50%;"></div>
        
        <div class="container py-5 position-relative z-1">
            <div class="row g-5">
                <!-- Brand Section -->
                <div class="col-lg-5 col-md-6 text-center text-md-start">
                    <a href="/html/index.html" class="d-inline-flex align-items-center gap-2 text-decoration-none mb-3">
                        <div class="d-flex align-items-center justify-content-center bg-marigold text-espresso rounded-circle" style="width: 48px; height: 48px;">
                            <i class="bi bi-shop fs-4"></i>
                        </div>
                        <span class="fs-3 fw-bold text-white">منصة بركة</span>
                    </a>
                    <p class="text-white-50 lh-lg pe-lg-4" style="font-size: 0.95rem;">
                        أول منصة رقمية متكاملة لربط محلات القرية، المشتريين، والطيارين في نظام بيئي واحد لدعم الاقتصاد المحلي وتسهيل حياة أهالينا.
                    </p>
                </div>

                <!-- Quick Links -->
                <div class="col-lg-3 col-md-6 text-center text-md-start">
                    <h5 class="fw-bold mb-4" style="color: var(--color-marigold);">روابط سريعة</h5>
                    <ul class="list-unstyled d-flex flex-column gap-3 mb-0">
                        <li><a href="/html/index.html" class="text-white-50 text-decoration-none footer-link-hover"><i class="bi bi-chevron-left small me-2 text-marigold"></i>الرئيسية</a></li>
                        <li><a href="/html/shops/list.html" class="text-white-50 text-decoration-none footer-link-hover"><i class="bi bi-chevron-left small me-2 text-marigold"></i>لف في المحلات</a></li>
                        <li><a href="/html/cart.html" class="text-white-50 text-decoration-none footer-link-hover"><i class="bi bi-chevron-left small me-2 text-marigold"></i>سلة الطلبات</a></li>
                    </ul>
                </div>

                <!-- Contact & Social -->
                <div class="col-lg-4 col-md-12 text-center text-md-start">
                    <h5 class="fw-bold mb-4" style="color: var(--color-marigold);">تواصل معنا</h5>
                    <div class="d-flex flex-column gap-3 mb-4">
                        <div class="d-flex align-items-center justify-content-center justify-content-md-start gap-3 text-white-50">
                            <i class="bi bi-geo-alt fs-5 text-marigold"></i>
                            <span>القرية الذكية، مصر</span>
                        </div>
                        <div class="d-flex align-items-center justify-content-center justify-content-md-start gap-3 text-white-50">
                            <i class="bi bi-envelope fs-5 text-marigold"></i>
                            <span dir="ltr">support@baraka.eg</span>
                        </div>
                    </div>
                </div>
            </div>

            <hr class="mt-5 mb-4 border-secondary opacity-25">

            <div class="row align-items-center">
                <div class="col-md-6 text-center text-md-start mb-3 mb-md-0">
                    <p class="mb-0 text-white-50" style="font-size: 0.9rem;">
                        صُنع بكل حب لدعم القرية المصرية 🌾 <span class="text-marigold fw-bold ms-1">© ٢٠٢٦ منصة بركة</span>
                    </p>
                </div>
                <div class="col-md-6 text-center text-md-end">
                    <a href="#" class="text-white-50 text-decoration-none small me-3 footer-link-hover">الشروط والأحكام</a>
                    <a href="#" class="text-white-50 text-decoration-none small footer-link-hover">سياسة الخصوصية</a>
                </div>
            </div>
        </div>
        
        <style>
            .bg-marigold { background-color: var(--color-marigold) !important; }
            .footer-link-hover { transition: all 0.3s ease; }
            .footer-link-hover:hover { color: var(--color-dune-light) !important; transform: translateX(-5px); display: inline-block; }
        </style>
    </footer>
    `;
}

function checkAuth() {
    // Auth elements are now rendered dynamically inside renderHeader() for a premium, single-source header flow.
    // Expose cart sync utility
    updateHeaderCartUI();
}

function updateHeaderCartUI() {
    const headerCount = document.getElementById('headerCartCount');
    if (!headerCount) return;
    
    // We count items from localStorage for global synchronization
    const cartItems = JSON.parse(localStorage.getItem('baraka_cart')) || [];
    const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    
    if (totalQty > 0) {
        headerCount.innerText = totalQty;
        headerCount.style.display = 'inline-block';
    } else {
        headerCount.style.display = 'none';
    }
}

// Expose globally
window.updateHeaderCartUI = updateHeaderCartUI;

window.logout = function() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('baraka_cart');
    localStorage.removeItem('current_shop_name');
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

window.showBarakaQRScanner = function(title = 'مسح رمز الاستجابة السريعة (QR)') {
    return new Promise((resolve) => {
        if (typeof Html5QrcodeScanner === 'undefined') {
            console.error("Html5QrcodeScanner is not loaded.");
            resolve(null);
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'baraka-modal-overlay';
        
        overlay.innerHTML = `
            <div class="baraka-modal-box" style="max-width: 500px;">
                <div class="baraka-modal-icon info" style="background: rgba(194, 146, 64, 0.12); color: #c29240;"><i class="bi bi-qr-code-scan"></i></div>
                <div class="baraka-modal-title">${title}</div>
                <div class="baraka-modal-text">قم بتوجيه الكاميرا نحو رمز الاستجابة السريعة لمسحه تلقائياً</div>
                
                <div id="qr-reader" style="width: 100%; border-radius: 12px; overflow: hidden; margin-bottom: 1.6rem; border: 2px solid rgba(201, 153, 151, 0.2); direction: ltr !important; background: #fff;"></div>
                
                <div class="baraka-modal-footer">
                    <button class="btn btn-outline-mesa baraka-modal-btn" id="barakaQRCancelBtn">إلغاء وإدخال يدوي</button>
                </div>
            </div>
        `;
        
        applyBarakaModalStyles(overlay);
        document.documentElement.appendChild(overlay);
        
        const cancelBtn = document.getElementById('barakaQRCancelBtn');
        const box = overlay.querySelector('.baraka-modal-box');
        
        setTimeout(() => {
            overlay.style.opacity = '1';
            if (box) box.style.transform = 'translateY(0) scale(1)';
        }, 50);
        
        let html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader", 
            { fps: 10, qrbox: {width: 250, height: 250} },
            /* verbose= */ false
        );
        
        const closeScanner = (val) => {
            html5QrcodeScanner.clear().catch(e => console.error("Failed to clear scanner", e));
            overlay.style.opacity = '0';
            if (box) box.style.transform = 'translateY(35px) scale(0.95)';
            setTimeout(() => {
                overlay.remove();
                resolve(val);
            }, 300);
        };
        
        function onScanSuccess(decodedText, decodedResult) {
            closeScanner(decodedText);
        }
        
        function onScanFailure(error) {
            // keep scanning
        }
        
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        
        cancelBtn.addEventListener('click', () => {
            closeScanner(null);
        });
    });
};

// ==========================================
// Global Toast Notification System
// ==========================================
window.showBarakaToast = function(message, type = 'success', icon = 'bi-check-circle-fill') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `baraka-toast toast-${type}`;
    toast.innerHTML = `<i class="bi ${icon} fs-5"></i> <span>${message}</span>`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastExit 0.3s var(--ease-out-expo) forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ==========================================
// Global Intersection Observer for Animations
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Initial check for elements
    document.querySelectorAll('.fade-in-up').forEach(el => {
        observer.observe(el);
    });
});

// ==========================================
// Reusable Premium Client-Side Pagination
// ==========================================
window.renderClientPagination = function(containerId, totalItems, currentPage, pageSize, onPageChangeFunctionName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <nav aria-label="Page navigation" class="mt-4 animate-up">
            <ul class="pagination justify-content-center gap-1 border-0">
    `;

    // Previous Button (RTL: Chevron Right moves to previous / right direction)
    const prevDisabled = currentPage === 1;
    html += `
        <li class="page-item ${prevDisabled ? 'disabled' : ''}">
            <button class="page-link rounded-circle d-flex align-items-center justify-content-center shadow-sm" 
                    style="width: 38px; height: 38px; color: ${prevDisabled ? 'var(--color-mesa)' : 'var(--color-marigold)'}; border-color: rgba(201,153,151,0.12); background: ${prevDisabled ? 'transparent' : 'white'};"
                    onclick="${onPageChangeFunctionName}(${currentPage - 1})" ${prevDisabled ? 'disabled' : ''}>
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;

    // Pages Numbers
    for (let i = 1; i <= totalPages; i++) {
        const isCurrent = i === currentPage;
        html += `
            <li class="page-item ${isCurrent ? 'active' : ''}">
                <button class="page-link rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" 
                        style="width: 38px; height: 38px; 
                               background: ${isCurrent ? 'var(--color-marigold)' : 'white'}; 
                               color: ${isCurrent ? 'white' : 'var(--color-espresso)'}; 
                               border-color: ${isCurrent ? 'var(--color-marigold)' : 'rgba(201,153,151,0.12)'};"
                        onclick="${onPageChangeFunctionName}(${i})">
                    ${i}
                </button>
            </li>
        `;
    }

    // Next Button (RTL: Chevron Left moves to next / left direction)
    const nextDisabled = currentPage === totalPages;
    html += `
        <li class="page-item ${nextDisabled ? 'disabled' : ''}">
            <button class="page-link rounded-circle d-flex align-items-center justify-content-center shadow-sm" 
                    style="width: 38px; height: 38px; color: ${nextDisabled ? 'var(--color-mesa)' : 'var(--color-marigold)'}; border-color: rgba(201,153,151,0.12); background: ${nextDisabled ? 'transparent' : 'white'};"
                    onclick="${onPageChangeFunctionName}(${currentPage + 1})" ${nextDisabled ? 'disabled' : ''}>
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;

    html += `
            </ul>
        </nav>
    `;

    container.innerHTML = html;
};

