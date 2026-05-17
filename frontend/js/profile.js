// ==========================================
// Baraka Customer Profile - Premium Dashboard
// ==========================================

let newImageFile = null;
let allCustomerOrders = [];
let autoRefreshTimer = null;
let countdownInterval = null;
let refreshSecondsLeft = 30;
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    fetchProfile();
    
    const imageInput = document.getElementById('image');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                newImageFile = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('profileImagePreview').innerHTML = `<img src="${e.target.result}" class="w-100 h-100 object-fit-cover">`;
                };
                reader.readAsDataURL(newImageFile);
            }
        });
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('access_token');
            const saveBtn = document.getElementById('saveBtn');
            const statusMsg = document.getElementById('statusMsg');
            
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span>جاري الحفظ...`;

            const formData = new FormData();
            formData.append('name', document.getElementById('name').value);
            formData.append('phone', document.getElementById('phone').value);
            formData.append('location', document.getElementById('location').value);
            
            const lat = document.getElementById('latitude').value;
            const lon = document.getElementById('longitude').value;
            if (lat) formData.append('latitude', lat);
            if (lon) formData.append('longitude', lon);

            if (newImageFile) {
                formData.append('image', newImageFile);
            }

            try {
                const updated = await api.auth.updateProfile(token, formData);
                statusMsg.className = 'text-success text-center fw-bold mt-2';
                statusMsg.innerText = '✅ تم حفظ التعديلات بنجاح!';
                statusMsg.style.fontSize = '1.05rem';
                statusMsg.classList.remove('d-none');

                // Update sidebar name
                const sidebarName = document.getElementById('sidebarUserName');
                if (sidebarName) sidebarName.innerText = updated.name || updated.phone;
            } catch (error) {
                statusMsg.className = 'text-danger text-center fw-bold mt-2';
                statusMsg.innerText = '❌ خطأ: ' + JSON.stringify(error);
                statusMsg.classList.remove('d-none');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i>حفظ التعديلات`;
                setTimeout(() => statusMsg.classList.add('d-none'), 5000);
            }
        });
    }
});

async function fetchProfile() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/html/auth/login.html';
        return;
    }

    try {
        const data = await api.auth.getProfile(token);
        
        document.getElementById('name').value = data.name || '';
        document.getElementById('phone').value = data.phone || '';
        document.getElementById('location').value = data.location || '';
        document.getElementById('latitude').value = data.latitude || '';
        document.getElementById('longitude').value = data.longitude || '';
        
        const roleMap = {
            'CUSTOMER': 'مشتري',
            'SHOP_OWNER': 'صاحب محل',
            'DRIVER': 'طيار (مندوب توصيل)',
            'ADMIN': 'مدير'
        };
        document.getElementById('role').value = roleMap[data.role] || data.role;

        // Update sidebar
        const sidebarName = document.getElementById('sidebarUserName');
        if (sidebarName) sidebarName.innerText = data.name || data.phone || 'عميل بركة';

        // Load orders only if orders list is present in DOM
        if (data.role === 'CUSTOMER' && document.getElementById('customerOrdersList')) {
            loadCustomerOrders();
        }

        if (data.image) {
            document.getElementById('profileImagePreview').innerHTML = `<img src="${data.image}" class="w-100 h-100 object-fit-cover">`;
        } else if (data.name) {
            document.getElementById('profileInitials').innerText = data.name.charAt(0);
        } else if (data.phone) {
            document.getElementById('profileInitials').innerText = data.phone.charAt(0);
        }
    } catch (error) {
        if (error.message === 'Unauthorized') {
            localStorage.removeItem('access_token');
            window.location.href = '/html/auth/login.html';
        } else {
            console.error("Failed to fetch profile:", error);
        }
    }
}

// ==========================================
// Order Status Step Mapping
// ==========================================
const ORDER_STEPS = [
    { key: 'PENDING',     icon: 'bi-hourglass-split', label: 'بانتظار الموافقة',  color: '#f59e0b' },
    { key: 'ACCEPTED',    icon: 'bi-hand-thumbs-up-fill', label: 'تم القبول',      color: '#3b82f6' },
    { key: 'PREPARING',   icon: 'bi-box-seam-fill',   label: 'جاري التحضير',       color: '#8b5cf6' },
    { key: 'ON_DELIVERY', icon: 'bi-truck',           label: 'في الطريق إليك',     color: '#c29240' },
    { key: 'DELIVERED',   icon: 'bi-check-circle-fill', label: 'تم التوصيل ✅',   color: '#22c55e' }
];

function getStepIndex(status) {
    const idx = ORDER_STEPS.findIndex(s => s.key === status);
    return idx >= 0 ? idx : -1;
}

function buildVisualStepper(currentStatus) {
    if (currentStatus === 'CANCELLED') {
        return `
            <div class="d-flex align-items-center justify-content-center py-3 gap-2">
                <i class="bi bi-x-octagon-fill text-danger" style="font-size: 2rem;"></i>
                <span class="fw-bold text-danger" style="font-size: 1.15rem;">تم إلغاء الطلب</span>
            </div>
        `;
    }

    const currentIdx = getStepIndex(currentStatus);
    let html = `<div class="baraka-stepper">`;
    
    ORDER_STEPS.forEach((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isPending = i > currentIdx;
        
        let circleClass = 'stepper-pending';
        let lineClass = 'stepper-line-pending';
        if (isDone) { circleClass = 'stepper-done'; lineClass = 'stepper-line-done'; }
        if (isCurrent) { circleClass = 'stepper-current'; }
        
        html += `
            <div class="stepper-step ${isCurrent ? 'stepper-step-active' : ''}">
                <div class="stepper-circle ${circleClass}" style="${isCurrent ? 'background:' + step.color + '; border-color:' + step.color + ';' : isDone ? 'background:#22c55e; border-color:#22c55e;' : ''}">
                    <i class="bi ${isDone ? 'bi-check-lg' : step.icon}" style="font-size: ${isCurrent ? '1.1rem' : '0.85rem'};"></i>
                </div>
                <div class="stepper-label ${isCurrent ? 'fw-bold' : ''}" style="${isCurrent ? 'color:' + step.color + ';' : ''}">${step.label}</div>
            </div>
        `;
        
        // Connecting line (not after last)
        if (i < ORDER_STEPS.length - 1) {
            html += `<div class="stepper-connector ${isDone ? 'stepper-line-done' : ''}"></div>`;
        }
    });
    
    html += `</div>`;
    return html;
}

// ==========================================
// Load and Render Customer Orders
// ==========================================
async function loadCustomerOrders() {
    const token = localStorage.getItem('access_token');
    try {
        const orders = await api.orders.getAll(token);
        allCustomerOrders = orders;
        
        // Update sidebar badge
        const badge = document.getElementById('sidebarOrdersBadge');
        if (badge) badge.innerText = orders.length;

        // Update stats
        const delivered = orders.filter(o => o.status === 'DELIVERED').length;
        const active = orders.filter(o => ['ON_DELIVERY', 'PREPARING', 'ACCEPTED'].includes(o.status)).length;
        const pending = orders.filter(o => o.status === 'PENDING').length;
        
        document.getElementById('statTotalOrders').innerText = orders.length;
        document.getElementById('statDelivered').innerText = delivered;
        document.getElementById('statActive').innerText = active;
        document.getElementById('statPending').innerText = pending;

        // Render with current filter
        renderOrders(allCustomerOrders.filter(o => applyFilterCondition(o, currentFilter)));
        
        startAutoRefresh();
    } catch (error) {
        console.error("Failed to load customer orders:", error);
    }
}

function applyFilterCondition(order, filter) {
    if (filter === 'active') return ['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'].includes(order.status);
    if (filter === 'delivered') return order.status === 'DELIVERED';
    if (filter === 'cancelled') return order.status === 'CANCELLED';
    return true;
}

function startAutoRefresh() {
    clearInterval(countdownInterval);
    clearTimeout(autoRefreshTimer);
    
    refreshSecondsLeft = 30;
    const countdownEl = document.getElementById('refreshCountdown');
    const indicatorEl = document.getElementById('autoRefreshIndicator');
    
    if (!countdownEl || !indicatorEl) return;
    
    // Only auto-refresh if there are active orders
    const hasActiveOrders = allCustomerOrders.some(o => ['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'].includes(o.status));
    
    if (hasActiveOrders) {
        indicatorEl.classList.remove('d-none');
        countdownInterval = setInterval(() => {
            refreshSecondsLeft--;
            if (countdownEl) countdownEl.innerText = refreshSecondsLeft;
            if (refreshSecondsLeft <= 0) {
                clearInterval(countdownInterval);
                loadCustomerOrders(); // This will restart the cycle
            }
        }, 1000);
    } else {
        indicatorEl.classList.add('d-none');
    }
}

window.manualRefresh = function() {
    const icon = document.getElementById('refreshIcon');
    if (icon) icon.classList.add('bi-arrow-clockwise-spin');
    
    loadCustomerOrders().finally(() => {
        if (icon) icon.classList.remove('bi-arrow-clockwise-spin');
        if(window.showBarakaToast) window.showBarakaToast('تم تحديث الطلبات', 'success', 'bi-arrow-clockwise');
    });
}

function renderOrders(orders) {
    const container = document.getElementById('customerOrdersList');
    if (!container) return;
    
    container.innerHTML = '';
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 animate-up">
                <div style="font-size: 4rem; opacity: 0.3; margin-bottom: 1rem;">📦</div>
                <p class="fw-bold text-espresso" style="font-size: 1.2rem;">لا توجد طلبات هنا</p>
                <p class="text-mesa" style="font-size: 1rem;">ابدأ بالتسوق من محلات القرية الآن!</p>
                <a href="/html/shops/list.html" class="btn btn-primary rounded-pill px-4 py-2 fw-bold mt-2" style="font-size: 1.05rem;">
                    <i class="bi bi-shop me-1"></i>تصفح المحلات
                </a>
            </div>
        `;
        return;
    }
    
    let allHtml = '';
    
    orders.forEach((order, i) => {
        const dateFormatted = new Date(order.created_at).toLocaleString('ar-EG', {
            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long', year: 'numeric'
        });
        
        const isCompleted = ['DELIVERED', 'CANCELLED'].includes(order.status);
        
        // Items list
        const itemsList = order.items.map(it => `
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom" style="border-color: rgba(201,153,151,0.06) !important;">
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-marigold bg-opacity-15 text-marigold rounded-pill px-2" style="font-size: 0.8rem;">x${it.quantity}</span>
                    <span class="text-espresso fw-bold" style="font-size: 0.98rem;">${it.product_details ? it.product_details.name : 'منتج'}</span>
                </div>
                <span class="text-marigold fw-bold" style="font-size: 0.95rem;">${it.price} ج.م</span>
            </div>
        `).join('');
        
        // Visual Order Stepper
        const stepperHtml = buildVisualStepper(order.status);
        
        // OTP Block
        let otpBlockHtml = '';
        if (!isCompleted && order.customer_otp) {
            otpBlockHtml = `
                <div class="mt-3 p-3 rounded-4 text-center" style="background: linear-gradient(135deg, rgba(194, 146, 64, 0.08), rgba(194, 146, 64, 0.03)); border: 2px dashed rgba(194, 146, 64, 0.25);">
                    <div class="mb-2">
                        <i class="bi bi-shield-lock-fill text-marigold" style="font-size: 1.5rem;"></i>
                    </div>
                    <div class="fw-bold text-espresso mb-1" style="font-size: 1.05rem;">رمز التسليم السري</div>
                    <div class="text-mesa small mb-2">أظهر هذا الرمز للمندوب عند الاستلام والدفع</div>
                    <div class="d-inline-block bg-white rounded-pill px-4 py-2 shadow-sm mb-2" style="border: 2px solid rgba(194, 146, 64, 0.2);">
                        <strong class="text-marigold" style="font-family: monospace; font-size: 2rem; letter-spacing: 8px;">${order.customer_otp}</strong>
                    </div>
                    <div id="qrcode-customer-${order.id}" class="d-flex justify-content-center my-2"></div>
                    <div class="text-mesa small mt-1" style="font-size: 0.82rem;">
                        <i class="bi bi-qr-code me-1"></i>أو اعرض رمز QR للمندوب ليمسحه بالكاميرا
                    </div>
                </div>
            `;
        } else if (order.status === 'DELIVERED' && !order.is_paid_to_shop) {
            otpBlockHtml = `
                <div class="alert alert-warning py-3 rounded-4 small mb-0 border-0 fw-bold mt-3 text-espresso text-center" style="font-size: 1rem;">
                    <i class="bi bi-clock-history me-1" style="font-size: 1.2rem;"></i><br>
                    تم التوصيل بنجاح!<br>
                    <span class="text-mesa fw-normal" style="font-size: 0.88rem;">بانتظار تصفية المندوب للمبلغ مع المحل.</span>
                </div>
            `;
        }
        
        // Dispute area
        if (order.dispute_status === 'PENDING') {
            otpBlockHtml = `
                <div class="alert alert-danger py-3 rounded-4 small mb-0 border-0 fw-bold mt-3 text-center" style="font-size: 1rem;">
                    <i class="bi bi-exclamation-octagon-fill me-1" style="font-size: 1.3rem;"></i><br>
                    الطلب قيد النزاع والتحقيق<br>
                    <span class="fw-normal" style="font-size: 0.88rem;">إدارة بركة تقوم بالفصل بين الأطراف.</span>
                </div>
            `;
        }
        
        let disputeActionHtml = '';
        if (order.dispute_status === 'NONE' && ['ON_DELIVERY', 'DELIVERED'].includes(order.status)) {
            disputeActionHtml = `
                <button onclick="raiseCustomerDispute(${order.id})" class="btn btn-outline-danger rounded-pill w-100 mt-3 fw-bold py-2" style="font-size: 0.95rem;">
                    <i class="bi bi-exclamation-octagon me-1"></i>تقديم شكوى بخصوص هذا الطلب
                </button>
            `;
        }

        // Total price calculation
        const totalPrice = (parseFloat(order.total_price) + (order.driver ? parseFloat(order.delivery_price) : 0)).toFixed(2);
        
        const html = `
            <div class="dashboard-card mb-4 animate-up order-card" 
                 data-status="${order.status}"
                 style="animation-delay: ${i * 0.06}s; border-right: 4px solid ${order.status === 'CANCELLED' ? '#ef4444' : order.status === 'DELIVERED' ? '#22c55e' : '#c29240'};">
                
                <!-- Order Header -->
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(194,146,64,0.12), rgba(194,146,64,0.04));">
                            <i class="bi bi-receipt text-marigold" style="font-size: 1.2rem;"></i>
                        </div>
                        <div>
                            <span class="fw-bold text-espresso" style="font-size: 1.1rem;">طلب #${order.id}</span>
                            <div class="text-mesa small">${dateFormatted}</div>
                        </div>
                    </div>
                </div>

                <!-- Visual Order Stepper -->
                ${stepperHtml}

                <!-- Shop & Driver Info -->
                <div class="mt-3 p-3 rounded-3" style="background: rgba(253, 245, 241, 0.5);">
                    <div class="d-flex align-items-center gap-2 mb-2" style="font-size: 1rem;">
                        <i class="bi bi-shop text-marigold" style="font-size: 1.2rem;"></i>
                        <span class="text-espresso fw-bold">${order.shop_details ? order.shop_details.name : 'محل بركة'}</span>
                    </div>
                    ${order.driver_details ? `
                    <div class="d-flex align-items-center gap-2" style="font-size: 1rem;">
                        <i class="bi bi-bicycle text-success" style="font-size: 1.2rem;"></i>
                        <span class="text-espresso">المندوب: <strong>${order.driver_details.name}</strong></span>
                        <a href="tel:${order.driver_details.phone}" class="btn btn-sm btn-outline-success rounded-pill px-2 py-0 ms-auto" style="font-size: 0.82rem;">
                            <i class="bi bi-telephone-fill me-1"></i>${order.driver_details.phone}
                        </a>
                    </div>
                    ` : ''}
                </div>

                <!-- Items List -->
                <div class="mt-3 p-3 bg-white rounded-3" style="border: 1px solid rgba(201,153,151,0.08);">
                    <div class="text-espresso fw-bold mb-2 pb-2 border-bottom d-flex align-items-center gap-2" style="font-size: 1rem; border-color: rgba(201,153,151,0.08) !important;">
                        <i class="bi bi-basket2-fill text-marigold"></i>
                        المنتجات المطلوبة
                    </div>
                    ${itemsList}
                    <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top" style="border-color: rgba(201,153,151,0.1) !important;">
                        <span class="fw-bold text-espresso" style="font-size: 1.1rem;">💰 الإجمالي المطلوب</span>
                        <span class="fw-bold text-marigold" style="font-size: 1.3rem;">${totalPrice} ج.م</span>
                    </div>
                    ${order.driver ? `
                    <div class="d-flex justify-content-between align-items-center mt-1 text-mesa small">
                        <span>(شامل رسوم التوصيل: ${order.delivery_price} ج.م)</span>
                    </div>` : ''}
                </div>

                <!-- OTP Block -->
                ${otpBlockHtml}

                <!-- Dispute Action -->
                ${disputeActionHtml}
            </div>
        `;
        allHtml += html;
    });
    
    container.innerHTML = allHtml;
    
    // Generate QR Codes
    orders.forEach((order) => {
        const isCompleted = ['DELIVERED', 'CANCELLED'].includes(order.status);
        if (!isCompleted && order.customer_otp) {
            const qrContainer = document.getElementById(`qrcode-customer-${order.id}`);
            if (qrContainer && typeof QRCode !== 'undefined') {
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: order.customer_otp,
                    width: 160,
                    height: 160,
                    colorDark : "#320404",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            }
        }
    });
}

// ==========================================
// Filter Orders
// ==========================================
window.filterOrders = function(filter, btnElement) {
    // Update active button style
    document.querySelectorAll('#orderFilterTabs button').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = '';
        btn.style.color = '';
    });
    if (btnElement) {
        btnElement.classList.add('active');
    }
    
    currentFilter = filter;
    let filtered = allCustomerOrders.filter(o => applyFilterCondition(o, currentFilter));
    renderOrders(filtered);
};

// ==========================================
// Dispute Reporting
// ==========================================
window.raiseCustomerDispute = async function(orderId) {
    const token = localStorage.getItem('access_token');
    const reason = await showBarakaPrompt('يرجى كتابة سبب تقديم الشكوى بالتفصيل (مثلاً: لم أستلم الطلب، المندوب أخذ مبلغاً إضافياً، إلخ):', 'اكتب سبب الشكوى هنا...', 'تقديم شكوى بخصوص الطلب ⚖️');
    if (!reason) return;
    
    try {
        await api.orders.raiseDispute(token, orderId, reason);
        await showBarakaAlert('تم تقديم الشكوى للإدارة بنجاح! سيتم التحقق فوراً للفصل في النزاع.', 'info', 'تم تسجيل الشكوى ⚖️');
        loadCustomerOrders();
    } catch (error) {
        await showBarakaAlert('فشل تقديم الشكوى: ' + JSON.stringify(error), 'warning', 'خطأ ⚠️');
    }
}
