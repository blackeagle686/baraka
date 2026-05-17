// =======================================================
// Baraka Premium Consolidated Cart & Tracking Dashboard
// =======================================================

let cart = [];
let customerOrders = [];
let refreshTimer = null;
let countdownTimer = null;
let secondsLeft = 30;
let ordersFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // Load and render current cart items
    loadLocalCart();
    
    // Attempt to pre-fill address from user profile
    autofillAddress();

    // Re-verify auth
    const token = localStorage.getItem('access_token');
    if (!token) {
        if(window.showBarakaToast) {
            window.showBarakaToast('سجل دخولك عشان تتابع وتعمل طلباتك!', 'warning', 'bi-box-arrow-in-left');
        }
        setTimeout(() => window.location.href = '/html/auth/login.html', 1500);
    }
});

// ==========================================
// Tab Switching System
// ==========================================
window.switchCartTab = function(tabId) {
    const panelCart = document.getElementById('panelActiveCart');
    const panelTracking = document.getElementById('panelOrderTracking');
    const btnCart = document.getElementById('btnTabCart');
    const btnOrders = document.getElementById('btnTabOrders');
    
    if (tabId === 'active-cart') {
        panelCart.classList.remove('d-none');
        panelTracking.classList.add('d-none');
        btnCart.classList.add('active');
        btnOrders.classList.remove('active');
        loadLocalCart(); // Refresh items
    } else {
        panelCart.classList.add('d-none');
        panelTracking.classList.remove('d-none');
        btnCart.classList.remove('active');
        btnOrders.classList.add('active');
        loadCartOrders(); // Fetch active orders tracking list
    }
}

// ==========================================
// Local Active Cart Operations
// ==========================================
function loadLocalCart() {
    cart = JSON.parse(localStorage.getItem('baraka_cart')) || [];
    renderActiveCart();
    
    // Sync navbar badge
    if (window.updateHeaderCartUI) {
        window.updfunction renderActiveCart() {
    const listContainer = document.getElementById('activeCartItemsList');
    const tabBadge = document.getElementById('cartTabBadge');
    
    const subtotalEl = document.getElementById('cartSubtotal');
    const totalSumEl = document.getElementById('cartTotalSum');
    
    if (!listContainer) return;
    
    // Update active cart tab item count badge
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (tabBadge) {
        if (totalQty > 0) {
            tabBadge.innerText = totalQty;
            tabBadge.style.display = 'inline-block';
        } else {
            tabBadge.style.display = 'none';
        }
    }

    if (cart.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-5 animate-up">
                <i class="bi bi-cart-x text-marigold fs-1 d-block mb-3" style="opacity: 0.35;"></i>
                <h4 class="fw-bold text-espresso mb-1">سلتك فاضية دلوقتي يا غالي!</h4>
                <p class="text-mesa mb-4">روح لف في المحلات واشتري شوية طماطم أو لبن طازة</p>
                <a href="/html/shops/list.html" class="btn btn-marigold text-white rounded-pill px-4 py-2 fw-bold">
                    <i class="bi bi-shop me-1"></i>روح لف في المحلات
                </a>
            </div>
        `;
        if (subtotalEl) subtotalEl.innerText = '0.00 ج.م';
        if (totalSumEl) totalSumEl.innerText = '0.00 ج.م';
        return;
    }
    
    // Group items by shop ID
    const grouped = {};
    cart.forEach(item => {
        const sid = item.shop || 9999;
        if (!grouped[sid]) {
            grouped[sid] = {
                shopId: sid,
                shopName: item.shopName || 'محل بركة',
                items: [],
                subtotal: 0
            };
        }
        grouped[sid].items.push(item);
        grouped[sid].subtotal += item.price * item.quantity;
    });
    
    let html = '';
    let globalSubtotal = 0;
    let globalDeliveryTotal = 0;
    
    Object.values(grouped).forEach(group => {
        const deliveryFee = 15; // delivery fee per shop trip
        const groupTotal = group.subtotal + deliveryFee;
        globalSubtotal += group.subtotal;
        globalDeliveryTotal += deliveryFee;
        
        let itemsHtml = '';
        group.items.forEach(item => {
            const itemTotal = item.price * item.quantity;
            itemsHtml += `
                <div class="cart-item-card animate-up" style="border: 0; border-bottom: 1px solid rgba(201,153,151,0.06); border-radius: 0; padding: 1.25rem 0;">
                    <div class="d-flex align-items-center gap-3">
                        ${item.image 
                            ? `<img src="${item.image}" class="cart-item-img">` 
                            : `<div class="cart-item-img d-flex align-items-center justify-content-center text-marigold"><i class="bi bi-box-seam fs-4"></i></div>`
                        }
                        <div>
                            <h5 class="fw-bold text-espresso mb-1" style="font-size: 1.05rem;">${item.name}</h5>
                            <span class="text-marigold fw-bold" style="font-size: 0.95rem;">${item.price} ج.م <span class="text-muted fw-normal small">للوحدة</span></span>
                        </div>
                    </div>
                    
                    <div class="d-flex align-items-center gap-4">
                        <!-- Qty Control -->
                        <div class="cart-qty-control">
                            <button class="cart-qty-btn" onclick="changeCartItemQty(${item.product}, -1)">-</button>
                            <span class="fw-bold text-espresso px-1" style="font-size: 1.05rem;">${item.quantity}</span>
                            <button class="cart-qty-btn" onclick="changeCartItemQty(${item.product}, 1)">+</button>
                        </div>
                        
                        <!-- Item Total Price -->
                        <span class="fw-bold text-espresso font-monospace" style="min-width: 80px; text-align: left; font-size: 1.05rem;">${itemTotal.toFixed(2)} ج.م</span>
                        
                        <!-- Remove Button -->
                        <button class="btn btn-sm btn-link text-danger p-1" onclick="removeCartItem(${item.product})" title="حذف">
                            <i class="bi bi-trash3 fs-5"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `
            <div class="dashboard-card mb-4 animate-up p-4" style="border: 1px solid rgba(194, 146, 64, 0.15);">
                <!-- Shop Header -->
                <div class="d-flex align-items-center gap-2 mb-3 pb-3 border-bottom" style="border-color: rgba(201,153,151,0.08) !important;">
                    <div class="rounded-circle d-flex align-items-center justify-content-center text-white" style="width: 36px; height: 36px; background: var(--color-marigold);">
                        <i class="bi bi-shop fs-5"></i>
                    </div>
                    <div>
                        <h4 class="fw-bold text-espresso mb-0" style="font-size: 1.15rem;">منتجات من: ${group.shopName}</h4>
                        <span class="text-mesa small">سيتم تسليمها وتوصيلها في طلب واحد مخصص</span>
                    </div>
                </div>
                
                <!-- Items list -->
                <div class="shop-group-items-list mb-3">
                    ${itemsHtml}
                </div>
                
                <!-- Shop specific delivery fee alert -->
                <div class="d-flex justify-content-between align-items-center mt-3 pt-2 text-mesa small">
                    <span>الإجمالي الفرعي للمحل</span>
                    <span class="fw-bold text-espresso">${group.subtotal.toFixed(2)} ج.م</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-1 text-mesa small">
                    <span>خدمة توصيل المحل (دليفري)</span>
                    <span class="fw-bold text-success">${deliveryFee.toFixed(2)} ج.م</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top fw-bold text-espresso" style="border-color: rgba(201,153,151,0.06) !important; font-size: 1.05rem;">
                    <span>حساب هذا الطلب</span>
                    <span class="text-marigold font-monospace">${groupTotal.toFixed(2)} ج.م</span>
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
    
    const globalTotal = globalSubtotal + globalDeliveryTotal;
    
    if (subtotalEl) subtotalEl.innerText = `${globalSubtotal.toFixed(2)} ج.م`;
    if (totalSumEl) totalSumEl.innerText = `${globalTotal.toFixed(2)} ج.م`;
}innerText = `${subtotal.toFixed(2)} ج.م`;
    if (totalSumEl) totalSumEl.innerText = `${totalSum.toFixed(2)} ج.م`;
}

window.changeCartItemQty = function(productId, delta) {
    const item = cart.find(it => it.product === productId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeCartItem(productId);
        } else {
            localStorage.setItem('baraka_cart', JSON.stringify(cart));
            loadLocalCart();
        }
    }
}

window.removeCartItem = function(productId) {
    cart = cart.filter(it => it.product !== productId);
    localStorage.setItem('baraka_cart', JSON.stringify(cart));
    loadLocalCart();
}

window.clearCurrentCart = function() {
    if (confirm('هل أنت متأكد من رغبتك في مسح كل المنتجات من السلة؟')) {
        cart = [];
        localStorage.setItem('baraka_cart', JSON.stringify(cart));
        loadLocalCart();
    }
}

async function autofillAddress() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
        const profile = await api.auth.getProfile(token);
        const addressInput = document.getElementById('cartOrderAddress');
        if (profile.location && addressInput && !addressInput.value.trim()) {
            addressInput.value = profile.location;
        }
    } catch(err) {
        console.error("Autofill address error:", err);
    }
}

// ==========================================
// submitCartCheckout (Place order)
// ==========================================
window.submitCartCheckout = async function() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        if(window.showBarakaToast) {
            window.showBarakaToast('سجل دخولك الأول يا غالي لتأكيد الطلب!', 'error', 'bi-exclamation-triangle');
        }
        return;
    }
    
    if (cart.length === 0) {
        alert('السلة فاضية! ضيف منتجات الأول.');
        return;
    }
    
    const addressInput = document.getElementById('cartOrderAddress');
    const address = addressInput ? addressInput.value.trim() : '';
    
    if (!address) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى كتابة عنوان التوصيل بالتفصيل أولاً.', 'error', 'bi-geo-alt');
        } else {
            alert('يرجى كتابة عنوان التوصيل أولاً.');
        }
        if(addressInput) addressInput.focus();
        return;
    }

    const checkoutBtn = document.getElementById('cartCheckoutBtn');
    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span>جاري تأكيد طلبك...`;
    }
    
    const shopId = cart[0].shop; // Self-describing shop attached during addToCart
    const orderData = {
        shop: parseInt(shopId),
        address: address,
        items: cart.map(it => ({ product: it.product, quantity: it.quantity }))
    };
    
    try {
        await api.orders.create(token, orderData);
        if (window.showBarakaToast) {
            window.showBarakaToast('يا فرج الله! تم تأكيد طلبك بنجاح وسيوصلك المندوب فوري!', 'success', 'bi-check-all');
        }
        
        // Clear local cart
        cart = [];
        localStorage.setItem('baraka_cart', JSON.stringify(cart));
        loadLocalCart();
        
        // Switch automatically to tracking tab to watch progress live!
        switchCartTab('order-tracking');
    } catch (error) {
        alert('حدث خطأ أثناء إرسال الطلب: ' + JSON.stringify(error));
    } finally {
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = `<i class="bi bi-check-all me-1"></i>تأكيد الطلب ودليفري فوري!`;
        }
    }
}

// ==========================================
// Order History & Live Tracking dashboard
// ==========================================
const ORDER_STEPS = [
    { key: 'PENDING',     icon: 'bi-hourglass-split', label: 'بانتظار الموافقة',  color: '#f59e0b' },
    { key: 'ACCEPTED',    icon: 'bi-hand-thumbs-up-fill', label: 'تم القبول',      color: '#3b82f6' },
    { key: 'PREPARING',   icon: 'bi-box-seam-fill',   label: 'جاري التحضير',       color: '#8b5cf6' },
    { key: 'ON_DELIVERY', icon: 'bi-truck',           label: 'في الطريق إليك',     color: '#c29240' },
    { key: 'DELIVERED',   icon: 'bi-check-circle-fill', label: 'تم التوصيل ✅',   color: '#22c55e' }
];

function getStepIndex(status) {
    return ORDER_STEPS.findIndex(s => s.key === status);
}

function buildVisualStepper(currentStatus) {
    if (currentStatus === 'CANCELLED') {
        return `
            <div class="d-flex align-items-center justify-content-center py-3 gap-2">
                <i class="bi bi-x-octagon-fill text-danger" style="font-size: 1.8rem;"></i>
                <span class="fw-bold text-danger" style="font-size: 1.1rem;">تم إلغاء الطلب</span>
            </div>
        `;
    }

    const currentIdx = getStepIndex(currentStatus);
    let html = `<div class="baraka-stepper mt-2 mb-4">`;
    
    ORDER_STEPS.forEach((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        
        let circleClass = 'stepper-pending';
        if (isDone) circleClass = 'stepper-done';
        if (isCurrent) circleClass = 'stepper-current';
        
        html += `
            <div class="stepper-step ${isCurrent ? 'stepper-step-active' : ''}">
                <div class="stepper-circle ${circleClass}" style="${isCurrent ? 'background:' + step.color + '; border-color:' + step.color + ';' : isDone ? 'background:#22c55e; border-color:#22c55e;' : ''}">
                    <i class="bi ${isDone ? 'bi-check-lg' : step.icon}" style="font-size: ${isCurrent ? '1rem' : '0.8rem'};"></i>
                </div>
                <div class="stepper-label ${isCurrent ? 'fw-bold' : ''}" style="${isCurrent ? 'color:' + step.color + ';' : ''}">${step.label}</div>
            </div>
        `;
        
        if (i < ORDER_STEPS.length - 1) {
            html += `<div class="stepper-connector ${isDone ? 'stepper-line-done' : ''}"></div>`;
        }
    });
    
    html += `</div>`;
    return html;
}

async function loadCartOrders() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    try {
        const orders = await api.orders.getAll(token);
        customerOrders = orders;
        
        // Filter and render
        renderCartOrdersList();
        
        // Start auto-refresh
        startAutoRefreshCart();
    } catch (error) {
        console.error("Failed to fetch customer orders:", error);
    }
}

function renderCartOrdersList() {
    const listEl = document.getElementById('cartOrdersLogList');
    if (!listEl) return;
    
    const filtered = customerOrders.filter(order => {
        if (ordersFilter === 'active') return ['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'].includes(order.status);
        if (ordersFilter === 'delivered') return order.status === 'DELIVERED';
        if (ordersFilter === 'cancelled') return order.status === 'CANCELLED';
        return true;
    });
    
    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-5 animate-up">
                <i class="bi bi-receipt-cutoff text-mesa fs-1 d-block mb-3" style="opacity: 0.35;"></i>
                <h4 class="fw-bold text-espresso mb-1">لا توجد طلبات هنا في الوقت الحالي</h4>
                <p class="text-mesa">سجل طلباتك الفريش يظهر هنا لمتابعته فوريًا</p>
            </div>
        `;
        return;
    }
    
    let allHtml = '';
    
    filtered.forEach((order, i) => {
        const dateFormatted = new Date(order.created_at).toLocaleString('ar-EG', {
            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long', year: 'numeric'
        });
        
        const isCompleted = ['DELIVERED', 'CANCELLED'].includes(order.status);
        
        // Product list breakdown HTML
        const itemsList = order.items.map(it => `
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom" style="border-color: rgba(201,153,151,0.06) !important;">
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-marigold bg-opacity-15 text-marigold rounded-pill px-2" style="font-size: 0.8rem;">x${it.quantity}</span>
                    <span class="text-espresso fw-bold" style="font-size: 0.95rem;">${it.product_details ? it.product_details.name : 'منتج فريش'}</span>
                </div>
                <span class="text-marigold fw-bold" style="font-size: 0.95rem;">${it.price} ج.م</span>
            </div>
        `).join('');
        
        // OTP Delivery block
        let otpHtml = '';
        if (!isCompleted && order.customer_otp) {
            otpHtml = `
                <div class="mt-3 p-3 rounded-4 text-center" style="background: linear-gradient(135deg, rgba(194, 146, 64, 0.06), rgba(194, 146, 64, 0.02)); border: 2px dashed rgba(194, 146, 64, 0.2);">
                    <div class="mb-2"><i class="bi bi-shield-lock-fill text-marigold fs-3"></i></div>
                    <div class="fw-bold text-espresso mb-1">رمز الاستلام السري</div>
                    <div class="text-mesa small mb-2">أظهر الرقم ده أو رمز الـ QR للمندوب لما يوصل بالطلب</div>
                    <div class="d-inline-block bg-white rounded-pill px-4 py-2 shadow-sm mb-3" style="border: 2px solid rgba(194, 146, 64, 0.25);">
                        <strong class="text-marigold" style="font-family: monospace; font-size: 1.8rem; letter-spacing: 6px;">${order.customer_otp}</strong>
                    </div>
                    <div id="qrcode-cart-${order.id}" class="d-flex justify-content-center my-2"></div>
                </div>
            `;
        } else if (order.status === 'DELIVERED' && !order.is_paid_to_shop) {
            otpHtml = `
                <div class="alert alert-warning py-3 rounded-4 small mb-0 border-0 fw-bold mt-3 text-espresso text-center">
                    <i class="bi bi-clock-history me-1" style="font-size: 1.1rem;"></i> تم التوصيل بنجاح! بانتظار تصفية الحساب للمحل.
                </div>
            `;
        }

        // Disputes Area
        let disputeActionHtml = '';
        if (order.dispute_status === 'PENDING') {
            otpHtml = `
                <div class="alert alert-danger py-3 rounded-4 small mb-0 border-0 fw-bold mt-3 text-center">
                    <i class="bi bi-exclamation-octagon-fill me-1" style="font-size: 1.1rem;"></i> الطلب قيد النزاع والتحقيق من الإدارة.
                </div>
            `;
        } else if (order.dispute_status === 'NONE' && ['ON_DELIVERY', 'DELIVERED'].includes(order.status)) {
            disputeActionHtml = `
                <button onclick="raiseDisputeOnCartOrder(${order.id})" class="btn btn-sm btn-outline-danger rounded-pill w-100 mt-3 fw-bold py-2">
                    <i class="bi bi-exclamation-octagon me-1"></i>تقديم شكوى بخصوص هذا الطلب
                </button>
            `;
        }
        
        const totalAmount = (parseFloat(order.total_price) + (order.driver ? parseFloat(order.delivery_price) : 0)).toFixed(2);
        
        const borderRightColor = order.status === 'CANCELLED' ? '#ef4444' : order.status === 'DELIVERED' ? '#22c55e' : '#c29240';
        
        allHtml += `
            <div class="dashboard-card mb-4 animate-up" style="border-right: 4px solid ${borderRightColor}; box-shadow: var(--shadow-sm);">
                <!-- Card Header -->
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; background: rgba(194, 146, 64, 0.08);">
                            <i class="bi bi-receipt text-marigold" style="font-size: 1.1rem;"></i>
                        </div>
                        <div>
                            <span class="fw-bold text-espresso" style="font-size: 1.05rem;">طلب #${order.id}</span>
                            <div class="text-mesa small" style="font-size: 0.8rem;">${dateFormatted}</div>
                        </div>
                    </div>
                </div>

                <!-- Live Visual Progress Stepper -->
                ${buildVisualStepper(order.status)}

                <!-- Shop & Driver Delivery Details -->
                <div class="mt-3 p-3 rounded-3" style="background: rgba(253, 245, 241, 0.45); border: 1px solid rgba(201,153,151,0.06);">
                    <div class="d-flex align-items-center gap-2 mb-2" style="font-size: 0.95rem;">
                        <i class="bi bi-shop text-marigold fs-5"></i>
                        <span class="text-espresso fw-bold">${order.shop_details ? order.shop_details.name : 'محل بركة'}</span>
                    </div>
                    ${order.driver_details ? `
                    <div class="d-flex align-items-center gap-2" style="font-size: 0.95rem;">
                        <i class="bi bi-bicycle text-success fs-5"></i>
                        <span class="text-espresso">المندوب: <strong>${order.driver_details.name}</strong></span>
                        <a href="tel:${order.driver_details.phone}" class="btn btn-sm btn-outline-success rounded-pill px-3 py-1 ms-auto" style="font-size: 0.8rem;">
                            <i class="bi bi-telephone-fill me-1"></i>اتصل بيه: ${order.driver_details.phone}
                        </a>
                    </div>
                    ` : `
                    <div class="d-flex align-items-center gap-2 text-mesa small" style="font-size: 0.88rem;">
                        <i class="bi bi-info-circle me-1"></i> بانتظار استلام طيار للتوصيل...
                    </div>
                    `}
                </div>

                <!-- Products breakdown -->
                <div class="mt-3 p-3 bg-white rounded-3" style="border: 1px solid rgba(201,153,151,0.06);">
                    <div class="text-espresso fw-bold mb-2 pb-2 border-bottom d-flex align-items-center gap-2" style="font-size: 0.95rem; border-color: rgba(201,153,151,0.08) !important;">
                        <i class="bi bi-basket2-fill text-marigold"></i>المنتجات المطلوبة
                    </div>
                    ${itemsList}
                    <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top" style="border-color: rgba(201,153,151,0.08) !important;">
                        <span class="fw-bold text-espresso" style="font-size: 1.05rem;">💰 إجمالي الحساب المطلوب</span>
                        <span class="fw-bold text-marigold font-monospace" style="font-size: 1.25rem;">${totalAmount} ج.م</span>
                    </div>
                    ${order.driver ? `<div class="text-mesa small mt-1" style="font-size: 0.8rem;">(شامل خدمة توصيل دليفري القرية: ${order.delivery_price} ج.م)</div>` : ''}
                </div>

                <!-- Delivery Verification OTP block -->
                ${otpHtml}

                <!-- Dispute actions -->
                ${disputeActionHtml}
            </div>
        `;
    });
    
    listEl.innerHTML = allHtml;
    
    // Generate QR codes for visual confirmation
    filtered.forEach(order => {
        const isCompleted = ['DELIVERED', 'CANCELLED'].includes(order.status);
        if (!isCompleted && order.customer_otp) {
            const qrContainer = document.getElementById(`qrcode-cart-${order.id}`);
            if (qrContainer && typeof QRCode !== 'undefined') {
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: order.customer_otp,
                    width: 140,
                    height: 140,
                    colorDark : "#320404",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            }
        }
    });
}

window.filterCartOrders = function(filter, btn) {
    ordersFilter = filter;
    
    // Manage active state of filter tags
    document.querySelectorAll('#ordersFilterList button').forEach(b => {
        b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
    
    renderCartOrdersList();
}

// ==========================================
// Auto Refresh Steppers
// ==========================================
function startAutoRefreshCart() {
    clearInterval(countdownTimer);
    clearTimeout(refreshTimer);
    
    secondsLeft = 30;
    const countdownEl = document.getElementById('cartRefreshCountdown');
    const indicatorEl = document.getElementById('cartAutoRefreshIndicator');
    
    if (!countdownEl || !indicatorEl) return;
    
    const hasActive = customerOrders.some(order => ['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'].includes(order.status));
    
    if (hasActive) {
        indicatorEl.style.display = 'flex';
        countdownTimer = setInterval(() => {
            secondsLeft--;
            if (countdownEl) countdownEl.innerText = secondsLeft;
            if (secondsLeft <= 0) {
                clearInterval(countdownTimer);
                loadCartOrders(); // restarts countdown
            }
        }, 1000);
    } else {
        indicatorEl.style.display = 'none';
    }
}

window.manualRefreshCartOrders = function() {
    const icon = document.getElementById('cartRefreshIcon');
    if (icon) icon.classList.add('bi-arrow-clockwise-spin');
    
    loadCartOrders().finally(() => {
        if (icon) icon.classList.remove('bi-arrow-clockwise-spin');
        if (window.showBarakaToast) {
            window.showBarakaToast('تم تحديث حالة طلباتك بنجاح!', 'success', 'bi-arrow-clockwise');
        }
    });
}

// Dispute creation helper
window.raiseDisputeOnCartOrder = async function(orderId) {
    const reason = prompt('ادخل سبب الشكوى بالتفصيل لإدارة بركة:');
    if (!reason || !reason.trim()) return;
    
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    try {
        await api.orders.raiseDispute(token, orderId, reason.trim());
        if(window.showBarakaToast) {
            window.showBarakaToast('تم تقديم الشكوى بنجاح وسيتم التواصل معك.', 'success', 'bi-exclamation-octagon');
        } else {
            alert('تم تقديم الشكوى بنجاح. سيقوم الدعم بمراجعتها فورا.');
        }
        loadCartOrders();
    } catch(err) {
        alert('فشل تقديم الشكوى: ' + JSON.stringify(err));
    }
}
