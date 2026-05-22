document.addEventListener('DOMContentLoaded', () => {
    initDriverDashboard();

    const driverImageInput = document.getElementById('driverImage');
    if (driverImageInput) {
        driverImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                
                // 1. Size Validation (2MB limit)
                const max_size = 2 * 1024 * 1024;
                if (file.size > max_size) {
                    alert('حجم صورة الحساب كبير جداً! الحد الأقصى هو 2 ميجابايت.');
                    e.target.value = ''; // Reset input field
                    return;
                }

                // 2. Format Extension Validation (.jpg, .jpeg, .png, .pdf)
                const allowed_exts = ['.jpg', '.jpeg', '.png', '.pdf'];
                const filename = file.name.toLowerCase();
                const matched = allowed_exts.some(ext => filename.endsWith(ext));
                if (!matched) {
                    alert('صيغة الملف غير مدعومة! الصيغ المسموح بها: JPG, PNG, PDF.');
                    e.target.value = ''; // Reset input field
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('driverImagePreview').innerHTML = `<img src="${e.target.result}" class="w-100 h-100 object-fit-cover rounded-circle">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

let currentDriver = null;
let driverMapInstance = null;
let driverMarkerInstance = null;
let currentRemainingCapacity = 5;
let isAccountSuspended = false;

async function initDriverDashboard() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/html/auth/login.html';
        return;
    }

    try {
        currentDriver = await api.auth.getProfile(token);
        
        // Ensure user is indeed a Driver
        if (currentDriver.role !== 'DRIVER') {
            alert('عذراً، هذه الصفحة مخصصة لشركاء التوصيل (الطيارين) فقط!');
            window.location.href = '/html/index.html';
            return;
        }

        // Set sidebar brand details
        document.getElementById('sidebarDriverName').innerText = currentDriver.name || currentDriver.phone;
        
        // Initialize fields
        populateDriverProfile(currentDriver);
        
        if (!currentDriver.is_approved) {
            renderUnapprovedDriverState();
            if (window.switchTab) {
                window.switchTab('settings');
            }
            const profileForm = document.getElementById('driverProfileForm');
            if (profileForm) {
                profileForm.addEventListener('submit', handleDriverProfileSubmit);
            }
            return;
        }

        // Load orders data
        await loadDriverOrders();

        // Start auto-refresh cycle every 15 seconds
        startDriverAutoRefresh();

        // Bind form save event
        const profileForm = document.getElementById('driverProfileForm');
        profileForm.addEventListener('submit', handleDriverProfileSubmit);

    } catch (error) {
        console.error("Initialization error:", error);
        localStorage.clear();
        window.location.href = '/html/auth/login.html';
    }
}

function renderUnapprovedDriverState() {
    const template = `
        <div class="dashboard-card text-center p-5 animate-up border border-secondary border-opacity-10 shadow-lg rounded-4 bg-white" style="max-width: 650px; margin: 2rem auto; direction: rtl; text-align: right;">
            <div class="mb-4 d-inline-flex align-items-center justify-content-center bg-warning bg-opacity-10 text-warning rounded-circle" style="width: 80px; height: 80px; font-size: 2.5rem; border: 2px dashed #ffc107;">
                <i class="bi bi-clock-history animate-pulse"></i>
            </div>
            <h3 class="fw-bold text-espresso mb-3 text-center">حسابك قيد المراجعة والاعتماد</h3>
            <p class="text-mesa mb-4 px-3 text-center" style="line-height: 1.7; font-size: 1.05rem;">
                أهلاً بك يا بطل في عائلة طياري <strong>منصة بركة</strong>! 🌾<br>
                يقوم فريق الإدارة حالياً بمراجعة طلب انضمامك وبياناتك للتأكد من مطابقتها وتفعيل حسابك. سيصلك إشعار فور اعتماد الحساب لتتمكن من استقبال طلبات التوصيل وجني الأرباح.
            </p>
            
            <!-- Steps Progress Flow -->
            <div class="row g-3 text-start mx-auto mb-4" style="max-width: 480px; direction: rtl; text-align: right;">
                <div class="col-12 d-flex align-items-center gap-3 bg-white p-3 rounded-4 border border-success border-opacity-20 shadow-xs">
                    <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; min-width: 32px;"><i class="bi bi-check-lg"></i></div>
                    <div>
                        <div class="fw-bold text-espresso small">الخطوة 1: التسجيل وتأكيد الهاتف</div>
                        <div class="text-muted" style="font-size: 0.75rem;">تم بنجاح ✓</div>
                    </div>
                </div>
                <div class="col-12 d-flex align-items-center gap-3 bg-white p-3 rounded-4 border border-warning border-opacity-20 shadow-xs">
                    <div class="bg-warning text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; min-width: 32px;"><i class="bi bi-hourglass-split"></i></div>
                    <div>
                        <div class="fw-bold text-espresso small">الخطوة 2: مراجعة الحساب وتفعيله</div>
                        <div class="text-warning fw-bold" style="font-size: 0.75rem;">جاري المراجعة من الإدارة...</div>
                    </div>
                </div>
                <div class="col-12 d-flex align-items-center gap-3 bg-white p-3 rounded-4 opacity-50 border border-secondary border-opacity-10">
                    <div class="bg-secondary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; min-width: 32px;"><i class="bi bi-lock-fill"></i></div>
                    <div>
                        <div class="fw-bold text-espresso small">الخطوة 3: بدء استقبال طلبات التوصيل</div>
                        <div class="text-muted" style="font-size: 0.75rem;">مغلق حتى تفعيل الحساب</div>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-info text-start d-flex align-items-start gap-3 rounded-4 py-3" style="direction: rtl; text-align: right;">
                <i class="bi bi-info-circle-fill text-info fs-4"></i>
                <div class="small text-espresso" style="line-height: 1.5;">
                    <strong>تلميح هام:</strong> يرجى الانتقال إلى قسم <strong>إعدادات الحساب</strong> وتحديث بياناتك الشخصية (الاسم، العنوان، تحديد موقعك الجغرافي الدقيق على الخريطة) لتسريع عملية الاعتماد من قبل الإدارة.
                </div>
            </div>
        </div>
    `;

    // Hide sidebar badges
    const availableBadge = document.getElementById('sidebarAvailableBadge');
    const tripsBadge = document.getElementById('sidebarTripsBadge');
    if (availableBadge) availableBadge.style.display = 'none';
    if (tripsBadge) tripsBadge.style.display = 'none';

    // Inject notice templates into panels
    const availablePanel = document.getElementById('availablePanel');
    const tripsPanel = document.getElementById('tripsPanel');
    const revenuePanel = document.getElementById('revenuePanel');

    if (availablePanel) availablePanel.innerHTML = template;
    if (tripsPanel) tripsPanel.innerHTML = template;
    if (revenuePanel) revenuePanel.innerHTML = template;
}

function populateDriverProfile(driver) {
    document.getElementById('driverName').value = driver.name || '';
    document.getElementById('driverPhone').value = driver.phone || '';
    document.getElementById('driverAddress').value = driver.location || '';
    document.getElementById('driverLatitude').value = driver.latitude || '';
    document.getElementById('driverLongitude').value = driver.longitude || '';

    // Handle avatar initials
    if (driver.image) {
        document.getElementById('driverImagePreview').innerHTML = `<img src="${driver.image}" class="w-100 h-100 object-fit-cover rounded-circle">`;
    } else {
        const initials = driver.name ? driver.name.charAt(0) : 'ط';
        document.getElementById('driverInitials').innerText = initials;
    }

    // Initialize Map with current driver coordinates
    initDriverMap(driver.latitude, driver.longitude);
}

// ==========================================
// OpenStreetMap & Leaflet Geolocation Sync
// ==========================================
function initDriverMap(lat, lon) {
    const latVal = parseFloat(lat) || 30.0444; // Default to Egypt
    const lonVal = parseFloat(lon) || 31.2357;

    const mapContainer = document.getElementById('driverMap');
    if (!mapContainer) return;

    if (driverMapInstance) {
        driverMapInstance.setView([latVal, lonVal], 14);
        if (driverMarkerInstance) {
            driverMarkerInstance.setLatLng([latVal, lonVal]);
        } else {
            driverMarkerInstance = L.marker([latVal, lonVal], { draggable: true }).addTo(driverMapInstance);
            bindDriverMarkerEvents();
        }
        return;
    }

    // Initialize Leaflet Map
    driverMapInstance = L.map('driverMap').setView([latVal, lonVal], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(driverMapInstance);

    driverMarkerInstance = L.marker([latVal, lonVal], { draggable: true }).addTo(driverMapInstance);
    bindDriverMarkerEvents();

    // Map click binding
    driverMapInstance.on('click', (e) => {
        const newLat = e.latlng.lat;
        const newLon = e.latlng.lng;
        driverMarkerInstance.setLatLng([newLat, newLon]);
        syncMapToDriverInputs(newLat, newLon);
    });

    // Two-way bindings for input fields
    const latInput = document.getElementById('driverLatitude');
    const lonInput = document.getElementById('driverLongitude');
    if (latInput && lonInput) {
        latInput.addEventListener('input', syncDriverInputsToMap);
        lonInput.addEventListener('input', syncDriverInputsToMap);
    }
}

function bindDriverMarkerEvents() {
    if (driverMarkerInstance) {
        driverMarkerInstance.on('dragend', () => {
            const pos = driverMarkerInstance.getLatLng();
            syncMapToDriverInputs(pos.lat, pos.lng);
        });
    }
}

function syncMapToDriverInputs(lat, lon) {
    const latInput = document.getElementById('driverLatitude');
    const lonInput = document.getElementById('driverLongitude');
    if (latInput) latInput.value = lat.toFixed(6);
    if (lonInput) lonInput.value = lon.toFixed(6);
}

function syncDriverInputsToMap() {
    const latVal = parseFloat(document.getElementById('driverLatitude').value);
    const lonVal = parseFloat(document.getElementById('driverLongitude').value);
    if (!isNaN(latVal) && !isNaN(lonVal)) {
        if (driverMarkerInstance && driverMapInstance) {
            driverMarkerInstance.setLatLng([latVal, lonVal]);
            driverMapInstance.setView([latVal, lonVal]);
        }
    }
}

// Hook tab switching for Leaflet size invalidation
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if (originalSwitchTab) {
        originalSwitchTab(tabId);
    }
    if (tabId === 'settings' && driverMapInstance) {
        setTimeout(() => {
            driverMapInstance.invalidateSize();
        }, 250);
    }
};

// ==========================================
// Profile updates submission
// ==========================================
async function handleDriverProfileSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const saveBtn = document.getElementById('saveDriverBtn');
    const statusMsg = document.getElementById('driverStatusMsg');

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span>جاري حفظ البيانات...`;

    const formData = new FormData();
    formData.append('name', document.getElementById('driverName').value.trim());
    formData.append('phone', document.getElementById('driverPhone').value.trim());
    formData.append('location', document.getElementById('driverAddress').value.trim());

    const latVal = document.getElementById('driverLatitude').value.trim();
    const lonVal = document.getElementById('driverLongitude').value.trim();
    if (latVal) formData.append('latitude', latVal);
    if (lonVal) formData.append('longitude', lonVal);

    const imageFile = document.getElementById('driverImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        const updated = await api.auth.updateProfile(token, formData);
        
        statusMsg.innerText = "تم حفظ تعديلات الحساب بنجاح!";
        statusMsg.className = "text-center fw-bold text-success mt-2";
        statusMsg.classList.remove('d-none');
        
        document.getElementById('sidebarDriverName').innerText = updated.name || updated.phone;
        
        if (updated.image) {
            document.getElementById('driverImagePreview').innerHTML = `<img src="${updated.image}" class="w-100 h-100 object-fit-cover rounded-circle">`;
        }

        setTimeout(() => statusMsg.classList.add('d-none'), 3000);
    } catch (error) {
        statusMsg.innerText = "خطأ أثناء الحفظ: " + JSON.stringify(error);
        statusMsg.className = "text-center fw-bold text-danger mt-2";
        statusMsg.classList.remove('d-none');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i>حفظ تفاصيل الحساب`;
    }
}

// ==========================================
// Load and render orders list
// ==========================================
async function loadDriverOrders() {
    const token = localStorage.getItem('access_token');
    try {
        const orders = await api.orders.getAll(token);
        
        // 1. Available orders: has no driver assigned, status PENDING, ACCEPTED, PREPARING or ON_DELIVERY
        const availableOrders = orders.filter(o => !o.driver && ['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'].includes(o.status));
        renderAvailableOrders(availableOrders);

        // 2. Active trips: assigned to this driver, not delivered/cancelled OR delivered but unpaid to shop
        const myActiveTrips = orders.filter(o => o.driver == currentDriver.id && (['ON_DELIVERY', 'ACCEPTED', 'PREPARING', 'PENDING_RETURN'].includes(o.status) || (o.status === 'DELIVERED' && !o.is_paid_to_shop)));
        
        // Calculate remaining capacity and suspension
        const activeInTransitCount = myActiveTrips.filter(o => ['ON_DELIVERY', 'ACCEPTED', 'PREPARING', 'PENDING_RETURN'].includes(o.status)).length;
        currentRemainingCapacity = Math.max(0, 5 - activeInTransitCount);
        
        const overdueDues = myActiveTrips.filter(o => {
            if (o.status === 'DELIVERED' && !o.is_paid_to_shop) {
                const pickedUpTime = o.picked_up_at ? new Date(o.picked_up_at).getTime() : new Date(o.created_at).getTime();
                const elapsedHours = (Date.now() - pickedUpTime) / (1000 * 60 * 60);
                return elapsedHours > 5;
            }
            return false;
        });
        const hasPendingReturn = myActiveTrips.some(o => o.status === 'PENDING_RETURN');
        isAccountSuspended = overdueDues.length > 0 || hasPendingReturn;
        
        renderActiveTrips(myActiveTrips);

        // 3. Completed trips: assigned to this driver, status DELIVERED
        const completedCount = orders.filter(o => o.driver == currentDriver.id && o.status === 'DELIVERED').length;
        document.getElementById('statCompletedCount').innerText = completedCount;

        // 4. Settle debts: total price of delivered orders that haven't been paid back to shop owners
        const pendingDues = orders.filter(o => o.driver == currentDriver.id && o.status === 'DELIVERED' && !o.is_paid_to_shop);
        const totalDebt = pendingDues.reduce((sum, o) => sum + parseFloat(o.total_price), 0);
        document.getElementById('statDebtCount').innerText = totalDebt.toFixed(2) + ' ج.م';

    } catch (error) {
        console.error("Error loading driver orders:", error);
    }
}

// ==========================================
// Driver Auto-Refresh Engine (15 seconds)
// ==========================================
let driverRefreshCountdownTimer = null;
let driverRefreshTimer = null;
let driverRefreshSecondsLeft = 15;

function startDriverAutoRefresh() {
    if (driverRefreshCountdownTimer) clearInterval(driverRefreshCountdownTimer);
    if (driverRefreshTimer) clearTimeout(driverRefreshTimer);

    const indicatorEl = document.getElementById('driverAutoRefreshIndicator');
    const countdownEl = document.getElementById('driverRefreshCountdown');

    if (!indicatorEl || !countdownEl) return;

    indicatorEl.style.display = 'flex';
    driverRefreshSecondsLeft = 15;
    countdownEl.innerText = driverRefreshSecondsLeft;

    if (driverRefreshCountdownTimer) clearInterval(driverRefreshCountdownTimer);
    driverRefreshCountdownTimer = setInterval(() => {
        driverRefreshSecondsLeft--;
        if (countdownEl) countdownEl.innerText = driverRefreshSecondsLeft;
        if (driverRefreshSecondsLeft <= 0) {
            clearInterval(driverRefreshCountdownTimer);
            driverRefreshCountdownTimer = null;
            loadDriverOrders().finally(() => {
                startDriverAutoRefresh();
            });
        }
    }, 1000);
}

window.manualRefreshDriverOrders = function() {
    const iconEl = document.getElementById('driverRefreshIcon');
    if (iconEl) iconEl.classList.add('bi-arrow-clockwise-spin');

    if (driverRefreshCountdownTimer) {
        clearInterval(driverRefreshCountdownTimer);
        driverRefreshCountdownTimer = null;
    }
    if (driverRefreshTimer) {
        clearTimeout(driverRefreshTimer);
        driverRefreshTimer = null;
    }

    loadDriverOrders().finally(() => {
        if (iconEl) iconEl.classList.remove('bi-arrow-clockwise-spin');
        if (window.showBarakaToast) {
            window.showBarakaToast('تم تحديث الطلبات المتاحة بنجاح!', 'success', 'bi-arrow-clockwise');
        }
        startDriverAutoRefresh();
    });
};

let currentAvailablePage = 1;
const AVAILABLE_PAGE_SIZE = 4;
let currentAvailableOrders = [];

window.changeAvailablePage = function(page) {
    currentAvailablePage = page;
    renderAvailableOrders(currentAvailableOrders);
};

function getCustomerGroupKey(order) {
    const customerId = order.customer || order.customer_details?.id || order.customer_details?.phone || 'unknown';
    return `${customerId}`;
}

function getCustomerName(order) {
    return order.customer_details?.name || order.customer_details?.phone || 'عميل بركة';
}

function getCustomerPhone(order) {
    return order.customer_details?.phone || '';
}

function moneyValue(value) {
    return (parseFloat(value) || 0).toFixed(2);
}

function sumOrderTotals(orders, field) {
    return orders.reduce((sum, order) => sum + (parseFloat(order[field]) || 0), 0);
}

function groupOrdersByCustomer(orders) {
    // Instead of grouping separate checkout orders, each order is its own independent trip!
    // Since the user already combined products from different shops into a single order at checkout,
    // this avoids any "double combining" and perfectly aligns each order record as one delivery.
    return orders.map((order) => {
        const stopsMap = new Map();
        
        // Process shops
        if (order.shops_details && order.shops_details.length > 0) {
            order.shops_details.forEach(s => {
                const key = `s_${s.id}`;
                if (!stopsMap.has(key)) {
                    stopsMap.set(key, {
                        type: 'shop',
                        id: s.id,
                        name: s.name,
                        address: s.address || '',
                        total: 0,
                        orders: [order],
                        allItemsReady: true
                    });
                }
                const stop = stopsMap.get(key);
                const stopItems = order.items.filter(it => it.product_details && it.product_details.shop_id === s.id);
                const stopTotal = stopItems.reduce((sum, it) => sum + (parseFloat(it.price) * it.quantity), 0);
                stop.total += stopTotal;
                if (stopItems.some(it => !it.is_ready)) stop.allItemsReady = false;
            });
        }
        
        // Process restaurants
        if (order.restaurants_details && order.restaurants_details.length > 0) {
            order.restaurants_details.forEach(r => {
                const key = `r_${r.id}`;
                if (!stopsMap.has(key)) {
                    stopsMap.set(key, {
                        type: 'restaurant',
                        id: `r_${r.id}`,
                        name: r.name,
                        address: r.address || '',
                        total: 0,
                        orders: [order],
                        allItemsReady: true
                    });
                }
                const stop = stopsMap.get(key);
                const stopItems = order.items.filter(it => it.menu_item_details && it.menu_item_details.restaurant_id === r.id);
                const stopTotal = stopItems.reduce((sum, it) => sum + (parseFloat(it.price) * it.quantity), 0);
                stop.total += stopTotal;
                if (stopItems.some(it => !it.is_ready)) stop.allItemsReady = false;
            });
        }

        // Fallback for legacy orders with only shop FK (no shops_details)
        if (stopsMap.size === 0 && (order.shop || order.shop_details)) {
            const key = `s_${order.shop || order.shop_details?.id}`;
            stopsMap.set(key, {
                type: 'shop',
                id: order.shop || order.shop_details?.id,
                name: order.shop_details?.name || 'محل بركة',
                address: order.shop_details?.address || '',
                total: parseFloat(order.total_price) || 0,
                orders: [order],
                allItemsReady: !order.items ? true : !order.items.some(it => !it.is_ready)
            });
        }

        const stopsList = Array.from(stopsMap.values());
        
        return {
            key: `${order.id}`,
            customerName: getCustomerName(order),
            customerPhone: getCustomerPhone(order),
            address: order.address || 'العنوان الافتراضي',
            orders: [order],
            shops: shopsList,
            totalProducts: parseFloat(order.total_price) || 0,
            totalDelivery: parseFloat(order.delivery_price) || 0,
            latestCreatedAt: new Date(order.created_at).getTime() || Date.now()
        };
    }).sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);
}

function renderOrderItems(order) {
    return order.items.map(it => {
        const itemReadyBadge = it.is_ready 
            ? `<span class="badge bg-success-subtle text-success rounded-pill px-2 py-0.5 fw-bold" style="font-size: 0.68rem;">جاهز 🟢</span>` 
            : `<span class="badge bg-warning-subtle text-warning rounded-pill px-2 py-0.5 fw-bold" style="font-size: 0.68rem;">يُحضّر ⏳</span>`;
        return `
            <div class="d-flex justify-content-between align-items-center text-muted small py-1.5 border-bottom border-light">
                <span>- ${it.product_details ? it.product_details.name : 'منتج'} (x${it.quantity})</span>
                ${itemReadyBadge}
            </div>
        `;
    }).join('');
}

function renderShopStops(group) {
    return group.shops.map((shop, index) => {
        const order = group.orders[0];
        const isShopPaid = order && order.paid_shops && order.paid_shops.split(',').includes(String(shop.id));
        
        const readyBadge = isShopPaid
            ? `<span class="badge bg-success text-white border border-success rounded-pill px-2 py-1 fw-bold" style="font-size: 0.76rem;"><i class="bi bi-check-circle-fill me-1"></i>تم سداد مستحقات المحل ✅</span>`
            : (shop.allItemsReady 
                ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 fw-bold" style="font-size: 0.76rem;"><i class="bi bi-check-circle-fill me-1"></i>الطلب جاهز للاستلام 🟢</span>` 
                : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2 py-1 fw-bold" style="font-size: 0.76rem;"><i class="bi bi-hourglass-split me-1"></i>جاري التحضير بالمحل ⏳</span>`);
            
        return `
            <div class="transit-stop-card transit-pickup animate-up">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                            <span class="badge bg-marigold text-white rounded-pill px-2 py-1 small" style="font-size: 0.8rem;">استلام من محل ${index + 1}</span>
                            ${readyBadge}
                        </div>
                        <div class="transit-title mt-1">${shop.name}</div>
                        <div class="transit-address"><i class="bi bi-geo-alt-fill text-marigold me-1"></i>${shop.address || 'عنوان المحل'}</div>
                    </div>
                    <div class="text-end">
                        <span class="text-marigold fw-extrabold fs-5">${moneyValue(shop.total)} ج.م</span>
                        <div class="text-muted small mt-1" style="font-size: 0.72rem;">طلبات: ${shop.orders.map(order => `#${order.id}`).join('، ')}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderAvailableOrders(orders) {
    currentAvailableOrders = orders;
    const container = document.getElementById('availableOrdersList');
    const badge = document.getElementById('sidebarAvailableBadge');
    const statVal = document.getElementById('statAvailableCount');

    if (badge) badge.innerText = orders.length;
    if (statVal) statVal.innerText = orders.length;
    if (!container) return;

    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up">
                <div class="empty-state-icon"><i class="bi bi-box-seam"></i></div>
                <p class="fw-bold">لا توجد طلبات معلقة بالقرية</p>
                <p class="small text-mesa">كل الطلبات تم استلامها بواسطة الطيارين الآخرين! عمل رائع.</p>
            </div>
        `;
        const paginationContainer = document.getElementById('driverAvailablePagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const groups = groupOrdersByCustomer(orders);
    const totalItems = groups.length;
    const totalPages = Math.ceil(totalItems / AVAILABLE_PAGE_SIZE);
    if (currentAvailablePage > totalPages) {
        currentAvailablePage = Math.max(1, totalPages);
    }
    
    const startIndex = (currentAvailablePage - 1) * AVAILABLE_PAGE_SIZE;
    const endIndex = Math.min(startIndex + AVAILABLE_PAGE_SIZE, totalItems);
    const slicedGroups = groups.slice(startIndex, endIndex);

    slicedGroups.forEach((group, i) => {
        const dateFormatted = new Date(group.latestCreatedAt).toLocaleString('ar-EG', {
            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
        });

        const orderBlocks = group.orders.map((order) => `
                <div class="bg-white rounded-3 p-2 mb-2" style="border: 1px solid rgba(201,153,151,0.08);">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold text-espresso small">طلب #${order.id}</span>
                        <span class="badge bg-warning-subtle text-warning rounded-pill px-2 py-1">${order.status === 'PREPARING' ? 'قيد التحضير' : 'ينتظر طيار'}</span>
                    </div>
                    <div class="text-muted small mb-1"><i class="bi bi-shop me-1"></i>${
                        order.shops_details && order.shops_details.length > 0
                            ? order.shops_details.map(s => s.name).join(' ، ')
                            : (order.shop_details ? order.shop_details.name : 'محل بركة')
                    }</div>
                    ${renderOrderItems(order)}
                    <div class="d-flex justify-content-between align-items-center mt-2 fw-bold text-espresso pt-1 border-top" style="border-color: rgba(201,153,151,0.08) !important;">
                        <span>حساب المحل:</span>
                        <span class="text-marigold">${moneyValue(order.total_price)} ج.م</span>
                    </div>
                </div>
        `).join('');

        const orderIds = group.orders.map(order => order.id).join(',');
        const priceInputId = `combinedDeliveryPriceInput-${group.orders[0].id}`;
        const maxAllowedPrice = Math.max(15.00, group.totalProducts * 0.02).toFixed(2);
        const isCombined = group.orders.length > 1;

        const html = `
            <div class="col-md-6 mb-3 animate-up" style="animation-delay: ${i * 0.05}s;">
                <div class="dashboard-card p-3 h-100 d-flex flex-column border shadow-sm" style="background-color: rgba(255,255,255,0.78); border-color: rgba(201,153,151,0.15) !important; border-radius: 20px;">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="badge ${isCombined ? 'bg-success text-white' : 'bg-warning text-dark'} rounded-pill px-3 py-2 fw-bold" style="font-size: 0.9rem;">
                            <i class="bi ${isCombined ? 'bi-truck-flatbed' : 'bi-truck'} me-1"></i>${isCombined ? 'رحلة مجمعة' : 'طلب واحد'} (${group.orders.length} طلبات)
                        </span>
                        <span class="text-muted small"><i class="bi bi-clock me-1"></i>آخر طلب: ${dateFormatted}</span>
                    </div>

                    <!-- Pickup Locations -->
                    <div class="mb-3">
                        <div class="text-espresso fw-bold mb-2 pb-1 border-bottom d-flex align-items-center gap-2" style="font-size: 1rem;">
                            <i class="bi bi-shop text-marigold fs-5"></i>
                            <span>1. محطات استلام المنتجات من المحلات:</span>
                        </div>
                        ${renderShopStops(group)}
                    </div>

                    <!-- Destination Location -->
                    <div class="mb-3">
                        <div class="text-espresso fw-bold mb-2 pb-1 border-bottom d-flex align-items-center gap-2" style="font-size: 1rem;">
                            <i class="bi bi-geo-alt-fill text-terracotta fs-5"></i>
                            <span>2. محطة تسليم العميل:</span>
                        </div>
                        <div class="transit-stop-card transit-dropoff">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="transit-title">${group.customerName}</div>
                                    <div class="transit-address"><i class="bi bi-house-door-fill text-terracotta me-1"></i>العنوان: <strong class="fs-5 text-espresso">${group.address}</strong></div>
                                </div>
                                ${group.customerPhone ? `
                                <div>
                                    <a href="tel:${group.customerPhone}" class="transit-phone-btn">
                                        <i class="bi bi-telephone-fill"></i>اتصال
                                    </a>
                                </div>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Hidden/Collapsed Details -->
                    <details class="transit-details mb-3">
                        <summary class="cursor-pointer small fw-bold text-espresso mb-1">📦 عرض تفاصيل محتويات الطلب والمنتجات</summary>
                        <div class="mt-2 bg-white rounded-3 p-2 border">
                            ${orderBlocks}
                        </div>
                    </details>

                    <!-- Financial Summary & Bid Input -->
                    <div class="mt-auto pt-3 border-top" style="border-color: rgba(201,153,151,0.1) !important;">
                        <div class="giant-badge-shop-total mb-3">
                            <span class="small fw-bold"><i class="bi bi-shop me-1"></i>إجمالي حساب المحلات:</span>
                            <span>${moneyValue(group.totalProducts)} ج.م</span>
                        </div>

                        <div class="mb-3 p-3 rounded-4" style="background: rgba(194, 146, 64, 0.04); border: 1px dashed rgba(194, 146, 64, 0.15);">
                            <label class="form-label text-espresso small fw-extrabold mb-1 d-flex align-items-center gap-1">
                                <i class="bi bi-cash-stack text-marigold fs-5"></i>
                                <span>حدد سعر خدمة التوصيل للرحلة كاملة:</span>
                            </label>
                            <div class="input-group shadow-none mt-1">
                                <span class="input-group-text bg-white border-end-0 rounded-end-pill px-3 fw-bold text-espresso">ج.م</span>
                                <input type="number" class="form-control bg-white border-start-0 rounded-start-pill px-3 py-2 fw-extrabold text-espresso fs-5 text-center shadow-none" id="${priceInputId}" value="15" min="15" max="${maxAllowedPrice}" step="1">
                            </div>
                            <span class="d-block text-muted px-2 mt-1" style="font-size: 0.72rem; line-height: 1.3;">
                                سعر موحد عادل لجميع طلبات العميل في هذه الرحلة | الحد الأدنى 15 ج.م | الحد الأقصى ${maxAllowedPrice} ج.م (2% من إجمالي الطلب)
                            </span>
                        </div>
                    </div>

                    ${(() => {
                        let capacityAlert = '';
                        let isBtnDisabled = false;
                        
                        if (isAccountSuspended) {
                            capacityAlert = `
                                <div class="alert alert-danger py-2 rounded-4 text-center small mb-2 border-0 fw-bold animate-pulse">
                                    🚫 حسابك معلق حالياً لوجود مستحقات مالية متأخرة لأكثر من 5 ساعات! يرجى سداد المحلات فوراً.
                                </div>
                            `;
                            isBtnDisabled = true;
                        } else if (group.orders.length > currentRemainingCapacity) {
                            capacityAlert = `
                                <div class="alert alert-warning py-2 rounded-4 text-center small mb-2 border-0 fw-bold">
                                    ⚠️ عدد الطلبات (${group.orders.length}) يتجاوز سعتك المتبقية (${currentRemainingCapacity} طلبات). حد السعة: 5 طلبات نشطة.
                                </div>
                            `;
                            isBtnDisabled = true;
                        } else {
                            capacityAlert = `
                                <div class="alert alert-success py-2 rounded-4 text-center small mb-2 border-0 fw-bold" style="background-color: rgba(25, 135, 84, 0.08); color: #198754;">
                                    🟢 متوافق مع سعتك المتبقية (متاح لك ${currentRemainingCapacity} طلبات).
                                </div>
                            `;
                        }
                        return `
                            ${capacityAlert}
                            <button class="btn btn-primary rounded-pill w-100 py-3 fw-bold fs-5 shadow-sm mt-2" onclick="acceptCombinedDeliveryTrip('${orderIds}', '${priceInputId}')" ${isBtnDisabled ? 'disabled' : ''}>
                                <i class="bi bi-check2-circle me-1"></i>قبول وتأكيد الرحلة المجمعة
                            </button>
                        `;
                    })()}
                </div>
            </div>
        `;
        container.innerHTML += html;
    });

    if (window.renderClientPagination) {
        window.renderClientPagination('driverAvailablePagination', totalItems, currentAvailablePage, AVAILABLE_PAGE_SIZE, 'window.changeAvailablePage');
    }
}

let currentTripsPage = 1;
const TRIPS_PAGE_SIZE = 4;
let currentActiveTrips = [];

window.changeTripsPage = function(page) {
    currentTripsPage = page;
    renderActiveTrips(currentActiveTrips);
};

function renderActiveTrips(trips) {
    currentActiveTrips = trips;
    const container = document.getElementById('activeTripsList');
    const badge = document.getElementById('sidebarTripsBadge');

    if (badge) badge.innerText = trips.length;
    if (!container) return;

    container.innerHTML = '';

    if (trips.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up">
                <div class="empty-state-icon"><i class="bi bi-truck"></i></div>
                <p class="fw-bold">لا توجد رحلات نشطة حالياً</p>
                <p class="small text-mesa">اذهب لقسم الطلبات المتاحة واقبل طلب توصيل جديد!</p>
            </div>
        `;
        const paginationContainer = document.getElementById('driverTripsPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const groups = groupOrdersByCustomer(trips);
    const totalItems = groups.length;
    const totalPages = Math.ceil(totalItems / TRIPS_PAGE_SIZE);
    if (currentTripsPage > totalPages) {
        currentTripsPage = Math.max(1, totalPages);
    }

    const startIndex = (currentTripsPage - 1) * TRIPS_PAGE_SIZE;
    const endIndex = Math.min(startIndex + TRIPS_PAGE_SIZE, totalItems);
    const slicedGroups = groups.slice(startIndex, endIndex);

    container.innerHTML = slicedGroups.map((group, i) => {
        const dateFormatted = new Date(group.latestCreatedAt).toLocaleString('ar-EG', {
            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
        });
        const orderIds = group.orders.map(order => order.id).join(',');
        const undeliveredOrders = group.orders.filter(order => order.status !== 'DELIVERED' && order.dispute_status !== 'PENDING');
        const deliveredUnpaidOrders = group.orders.filter(order => order.status === 'DELIVERED' && !order.is_paid_to_shop);
        const disputedOrders = group.orders.filter(order => order.dispute_status === 'PENDING');
        const isCombined = group.orders.length > 1;

        let statusBadgeHtml = `<span class="badge bg-success-subtle text-success rounded-pill px-2 py-1">جاري التوصيل للعميل</span>`;
        if (disputedOrders.length) {
            statusBadgeHtml = `<span class="badge bg-danger text-white rounded-pill px-2 py-1">بها نزاع</span>`;
        } else if (!undeliveredOrders.length && deliveredUnpaidOrders.length) {
            statusBadgeHtml = `<span class="badge bg-danger-subtle text-danger rounded-pill px-2 py-1">بانتظار سداد حساب المحلات</span>`;
        }

        const ordersHtml = group.orders.map((trip) => {
            const isDisputed = trip.dispute_status === 'PENDING';
            const isDeliveredUnpaid = trip.status === 'DELIVERED' && !trip.is_paid_to_shop;
            const isPendingReturn = trip.status === 'PENDING_RETURN';
            const orderStatus = isDisputed ? 'قيد النزاع' : isDeliveredUnpaid ? 'تم التسليم - ينتظر تصفية المحل' : isPendingReturn ? 'بانتظار إرجاع المرتجعات للمحل 📥' : trip.status === 'DELIVERED' ? 'تم التسليم' : 'جاري التوصيل';

            return `
                <div class="bg-white rounded-3 p-2 mb-2" style="border: 1px solid rgba(201,153,151,0.08);">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold text-espresso small">طلب #${trip.id}</span>
                        <span class="badge ${isDisputed || isPendingReturn ? 'bg-danger text-white' : isDeliveredUnpaid ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'} rounded-pill px-2 py-1">${orderStatus}</span>
                    </div>
                    <div class="text-muted small mb-1"><i class="bi bi-shop me-1"></i>${
                        trip.shops_details && trip.shops_details.length > 0
                            ? trip.shops_details.map(s => s.name).join(' ، ')
                            : (trip.shop_details ? trip.shop_details.name : 'محل بركة')
                    }</div>
                    ${renderOrderItems(trip)}
                    <div class="d-flex justify-content-between align-items-center mt-2 fw-bold text-espresso pt-1 border-top" style="border-color: rgba(201,153,151,0.08) !important;">
                        <span>حساب المحل:</span>
                        <span class="text-marigold">${moneyValue(trip.total_price)} ج.م</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-1 fw-bold text-success pt-1">
                        <span>خدمة التوصيل:</span>
                        <span>${moneyValue(trip.delivery_price)} ج.م</span>
                    </div>
                    ${isDeliveredUnpaid ? (() => {
                        const pickedUpTime = trip.picked_up_at ? new Date(trip.picked_up_at).getTime() : new Date(trip.created_at).getTime();
                        const elapsedHours = (Date.now() - pickedUpTime) / (1000 * 60 * 60);
                        const remainingHours = 5 - elapsedHours;
                        let timerBadge = '';
                        if (remainingHours <= 0) {
                            timerBadge = `<div class="badge bg-danger text-white w-100 py-2 rounded-3 fw-bold mb-2 fs-7 animate-pulse"><i class="bi bi-exclamation-octagon-fill me-1"></i>متأخر لأكثر من 5 ساعات! حسابك معلق مؤقتاً ⚠️</div>`;
                        } else {
                            const remHrs = Math.floor(remainingHours);
                            const remMins = Math.floor((remainingHours - remHrs) * 60);
                            timerBadge = `<div class="badge bg-warning-subtle text-warning border border-warning-subtle w-100 py-2 rounded-3 fw-bold mb-2 fs-7"><i class="bi bi-clock-history me-1"></i>متبقي للتسوية: ${remHrs} ساعة و ${remMins} دقيقة ⏳</div>`;
                        }
                        
                        const paidShopsList = trip.paid_shops ? trip.paid_shops.split(',') : [];
                        const unpaidShops = trip.shops_details ? trip.shops_details.filter(s => !paidShopsList.includes(String(s.id))) : [];
                        
                        let shopOtpsHtml = '';
                        if (unpaidShops.length > 0) {
                            shopOtpsHtml = unpaidShops.map(s => {
                                const shopOtp = (trip.shop_otps_map && trip.shop_otps_map[String(s.id)]) || trip.driver_otp || '----';
                                const postponedShopsList = trip.postponed_shops ? trip.postponed_shops.split(',') : [];
                                const isPostponed = postponedShopsList.includes(String(s.id));
                                
                                return `
                                    <div class="d-flex justify-content-between align-items-center bg-light p-2.5 rounded-3 mb-2 border" style="border-color: rgba(201,153,151,0.08) !important;">
                                        <div>
                                            <span class="fw-bold text-espresso small"><i class="bi bi-shop text-marigold me-1"></i>${s.name}:</span>
                                            ${isPostponed ? '<span class="badge bg-warning-subtle text-warning ms-1 small">مؤجل 🚪</span>' : ''}
                                        </div>
                                        <div class="d-flex align-items-center gap-2">
                                            ${isPostponed ? `
                                                <span class="text-muted small">بانتظار الفتح والتسوية</span>
                                            ` : `
                                                <strong class="fs-6 text-success" style="font-family: monospace; letter-spacing: 2px;">${shopOtp}</strong>
                                                <button class="btn btn-sm btn-outline-success p-1 border-0" onclick="event.stopPropagation(); showQrCodeForShopOtp('${trip.id}', '${s.name}', '${shopOtp}')" title="عرض رمز QR">
                                                    <i class="bi bi-qr-code fs-6"></i>
                                                </button>
                                                <button class="btn btn-sm btn-outline-warning p-1 border-0" onclick="event.stopPropagation(); postponeShopSettlement('${trip.id}', '${s.id}', '${s.name}')" title="المحل مغلق - تأجيل السداد">
                                                    <i class="bi bi-door-closed fs-6"></i>
                                                </button>
                                            `}
                                        </div>
                                    </div>
                                `;
                            }).join('');
                        } else {
                            shopOtpsHtml = `
                                <span class="small text-mesa d-block mb-1">رمز تصفية الحساب العام:</span>
                                <strong class="fs-5 text-success" style="font-family: monospace; letter-spacing: 4px;">${trip.driver_otp || '----'}</strong>
                            `;
                        }
                        
                        return `
                            <div class="mt-2 p-2 bg-white rounded-3 border text-espresso text-center">
                                ${timerBadge}
                                <div class="alert alert-warning py-1.5 rounded-3 mb-2 border-0 small text-center fw-bold text-espresso">
                                    المحلات المتبقية لتسوية الكاش:
                                </div>
                                <div class="text-start">
                                    ${shopOtpsHtml}
                                </div>
                                <div id="qrcode-driver-${trip.id}" class="d-flex justify-content-center my-2 d-none"></div>
                            </div>
                            <button onclick="raiseDriverDispute(${trip.id})" class="btn btn-sm btn-outline-danger rounded-pill w-100 mt-1">
                                <i class="bi bi-exclamation-octagon me-1"></i>نزاع مع هذا المحل
                            </button>
                        `;
                    })() : ''}
                </div>
            `;
        }).join('');

        let actionHtmlBlock = '';
        const tripHasPendingReturn = group.orders.some(o => o.status === 'PENDING_RETURN');
        
        if (tripHasPendingReturn) {
            actionHtmlBlock = `
                <div class="alert alert-danger text-center py-3 rounded-4 mb-0 border-0 fw-bold shadow-sm flex-grow-1 animate-pulse" style="background-color: rgba(220,53,69,0.08); color: var(--color-terracotta);">
                    <div><i class="bi bi-exclamation-octagon-fill me-1"></i>حسابك معلق مؤقتاً! يجب عليك التوجه للمحلات وإرجاع المنتجات. اطلب من صاحب المحل تأكيد استلام المرتجعات لإعادة تنشيط حسابك.</div>
                </div>
            `;
        } else if (disputedOrders.length) {
            actionHtmlBlock = `
                <div class="alert alert-danger text-center py-2 rounded-pill small mb-0 fw-bold border-0 flex-grow-1" style="background-color: rgba(220,53,69,0.08); color: var(--color-terracotta);">
                    <i class="bi bi-exclamation-circle me-1"></i>يوجد طلب قيد النزاع والمراجعة.
                </div>
            `;
        } else if (undeliveredOrders.length) {
            actionHtmlBlock = `
                <div class="d-flex flex-column w-100 gap-2">
                    <button class="btn btn-success rounded-pill py-2.5 fw-bold w-100" onclick="completeCombinedDeliveryTrip('${orderIds}')">
                        <i class="bi bi-check2-all me-1"></i>${isCombined ? 'تسليم كل طلبات العميل' : 'تم التوصيل بنجاح للعميل'}
                    </button>
                    <button class="btn btn-outline-danger rounded-pill py-2 fw-bold w-100" onclick="reportTripEmergency('${orderIds}')">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i>أواجه حالة طارئة / إلغاء الرحلة 🚨
                    </button>
                </div>
            `;
        } else if (deliveredUnpaidOrders.length) {
            actionHtmlBlock = `
                <div class="alert alert-danger text-center py-3 rounded-4 mb-0 border-0 fw-bold shadow-sm flex-grow-1" style="background-color: rgba(220,53,69,0.06); color: var(--color-terracotta);">
                    <div><i class="bi bi-exclamation-triangle-fill me-1"></i>بعد استلام الكاش من العميل، ارجع مبلغ كل محل كما هو موضح في خط السير.</div>
                </div>
            `;
        }

        return `
            <div class="col-md-6 mb-3 animate-up" style="animation-delay: ${i * 0.05}s;">
                <div class="dashboard-card p-3 h-100 d-flex flex-column border" style="background-color: rgba(255,255,255,0.7); border-color: rgba(201,153,151,0.12) !important;">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="fw-bold text-espresso">${isCombined ? 'رحلة مجمعة' : 'رحلة'} للعميل: ${group.customerName}</span>
                        ${statusBadgeHtml}
                    </div>

                    <div class="mb-3">
                        <div class="text-muted small mb-1"><i class="bi bi-person me-1"></i>اسم العميل: <strong class="text-espresso">${group.customerName}</strong> ${group.customerPhone ? `(${group.customerPhone})` : ''}</div>
                        <div class="text-muted small mb-1"><i class="bi bi-geo-alt me-1"></i>عنوان العميل: <strong class="text-espresso">${group.address}</strong></div>
                        <div class="text-muted small mb-2"><i class="bi bi-clock me-1"></i>آخر تحديث: ${dateFormatted}</div>
                    </div>

                    <div class="mb-3">
                        <div class="text-muted small mb-2 border-bottom pb-1 fw-bold">خط سير المحلات والمبلغ الراجع لكل محل:</div>
                        ${renderShopStops(group)}
                    </div>

                    <div class="flex-grow-1 mb-3">
                        <div class="text-muted small mb-2 border-bottom pb-1 fw-bold">تفاصيل الطلبات:</div>
                        ${ordersHtml}
                    </div>

                    <div class="bg-white rounded-3 p-2 mb-3" style="border: 1px solid rgba(201,153,151,0.08);">
                        <div class="d-flex justify-content-between fw-bold text-espresso">
                            <span>إجمالي حساب المحلات:</span>
                            <span class="text-marigold">${moneyValue(group.totalProducts)} ج.م</span>
                        </div>
                        <div class="d-flex justify-content-between fw-bold text-success">
                            <span>إجمالي خدمة التوصيل:</span>
                            <span>${moneyValue(group.totalDelivery)} ج.م</span>
                        </div>
                        <div class="d-flex justify-content-between fw-bold text-espresso border-top mt-1 pt-1" style="border-color: rgba(201,153,151,0.1) !important;">
                            <span>المطلوب من العميل:</span>
                            <span class="text-marigold">${moneyValue(group.totalProducts + group.totalDelivery)} ج.م</span>
                        </div>
                    </div>

                    <div class="d-flex gap-2">
                        ${actionHtmlBlock}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    slicedGroups.flatMap(group => group.orders).forEach((trip) => {
        const isDeliveredUnpaid = (trip.status === 'DELIVERED' && !trip.is_paid_to_shop);
        if (isDeliveredUnpaid && trip.driver_otp) {
            const qrContainer = document.getElementById(`qrcode-driver-${trip.id}`);
            if (qrContainer && typeof QRCode !== 'undefined') {
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: trip.driver_otp,
                    width: 120,
                    height: 120,
                    colorDark : "#198754",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            }
        }
    });

    if (window.renderClientPagination) {
        window.renderClientPagination('driverTripsPagination', totalItems, currentTripsPage, TRIPS_PAGE_SIZE, 'window.changeTripsPage');
    }
    return;
}

window.acceptDeliveryTrip = async function(orderId) {
    const token = localStorage.getItem('access_token');
    const priceInput = document.getElementById(`deliveryPriceInput-${orderId}`);
    const deliveryPrice = parseFloat(priceInput.value) || 15.00;

    try {
        await api.orders.acceptDelivery(token, orderId, deliveryPrice);
        await showBarakaAlert('تم قبول الرحلة وتعيينك طياراً للتوصيل بنجاح!', 'info', 'تم القبول ✅');
        loadDriverOrders();
    } catch (error) {
        await showBarakaAlert('حدث خطأ أثناء قبول الرحلة: ' + (error.detail || JSON.stringify(error)), 'warning', 'خطأ في القبول ⚠️');
    }
}

window.acceptCombinedDeliveryTrip = async function(orderIdsText, priceInputId = null) {
    const token = localStorage.getItem('access_token');
    const orderIds = String(orderIdsText).split(',').map(id => parseInt(id, 10)).filter(Boolean);
    if (!orderIds.length) return;

    try {
        const fallbackPriceInput = document.getElementById(`deliveryPriceInput-${orderIds[0]}`);
        const sharedPriceInput = priceInputId ? document.getElementById(priceInputId) : fallbackPriceInput;
        const deliveryPrice = parseFloat(sharedPriceInput?.value) || 15.00;

        await api.orders.acceptDelivery(token, orderIds[0], deliveryPrice);

        const message = 'تم قبول الرحلة وتعيينك طياراً للتوصيل بنجاح!';
        await showBarakaAlert(message, 'info', 'تم القبول ✅');
        loadDriverOrders();
    } catch (error) {
        await showBarakaAlert('حدث خطأ أثناء قبول الرحلة: ' + (error.detail || JSON.stringify(error)), 'warning', 'خطأ في القبول ⚠️');
        loadDriverOrders();
    }
}

window.completeDeliveryTrip = async function(orderId) {
    const token = localStorage.getItem('access_token');
    
    // Attempt QR Code Scan first
    let customerOtp = await showBarakaQRScanner('مسح رمز QR للعميل 📦');
    
    // Fallback to manual entry if cancelled or unavailable
    if (!customerOtp) {
        customerOtp = await showBarakaPrompt('برجاء إدخال رمز التحقق المستلم من العميل (المكون من 4 أرقام) لتأكيد تسليم الطلب واستلام الكاش:', 'مثال: 1234', 'تأكيد التسليم للعميل 📦');
    }
    
    if (!customerOtp) return;
    
    try {
        await api.orders.updateStatus(token, orderId, 'DELIVERED', { customer_otp: customerOtp });
        await showBarakaAlert('تم التحقق من رمز العميل وتأكيد التوصيل بنجاح!', 'info', 'تم التوصيل 🎉');
        loadDriverOrders();
    } catch (error) {
        await showBarakaAlert('حدث خطأ أثناء إكمال التوصيل: ' + (error.detail || JSON.stringify(error)), 'warning', 'خطأ في التوصيل ⚠️');
    }
}

window.completeCombinedDeliveryTrip = async function(orderIdsText) {
    const token = localStorage.getItem('access_token');
    const orderIds = String(orderIdsText).split(',').map(id => parseInt(id, 10)).filter(Boolean);
    if (!orderIds.length) return;

    try {
        for (const orderId of orderIds) {
            const trip = currentActiveTrips.find(order => order.id === orderId);
            if (!trip || trip.status === 'DELIVERED' || trip.dispute_status === 'PENDING') continue;

            let customerOtp = await showBarakaQRScanner(`مسح رمز QR للعميل - طلب #${orderId} 📦`);
            if (!customerOtp) {
                customerOtp = await showBarakaPrompt(`أدخل رمز تحقق العميل لطلب #${orderId}:`, 'مثال: 1234', `تأكيد تسليم طلب #${orderId}`);
            }
            if (!customerOtp) return;

            await api.orders.updateStatus(token, orderId, 'DELIVERED', { customer_otp: customerOtp });
        }

        await showBarakaAlert('تم تأكيد تسليم طلبات العميل بنجاح. ستظهر لك الآن مبالغ التصفية الراجعة لكل محل.', 'info', 'تم التوصيل 🎉');
        loadDriverOrders();
    } catch (error) {
        await showBarakaAlert('حدث خطأ أثناء إكمال التوصيل المجمع: ' + (error.detail || JSON.stringify(error)), 'warning', 'خطأ في التوصيل ⚠️');
        loadDriverOrders();
    }
}

window.raiseDriverDispute = async function(orderId) {
    const token = localStorage.getItem('access_token');
    const reason = await showBarakaPrompt('يرجى كتابة سبب تقديم الشكوى بالتفصيل (مثل: قمت بسداد المبلغ ولكن صاحب المحل يرفض التصفية، إلخ):', 'اكتب سبب النزاع هنا...', 'تقديم شكوى / نزاع ⚖️');
    if (!reason) return;
    
    try {
        await api.orders.raiseDispute(token, orderId, reason);
        await showBarakaAlert('تم تقديم الشكوى للإدارة بنجاح! جاري المراجعة للفصل بالنزاع.', 'info', 'تم تسجيل النزاع ⚖️');
        loadDriverOrders();
    } catch (error) {
        await showBarakaAlert('فشل تقديم الشكوى: ' + JSON.stringify(error), 'warning', 'خطأ ⚠️');
    }
}

window.reportTripEmergency = async function(orderIdsText) {
    const token = localStorage.getItem('access_token');
    const orderIds = String(orderIdsText).split(',').map(id => parseInt(id, 10)).filter(Boolean);
    if (!orderIds.length) return;

    const reason = await showBarakaPrompt(
        '⚠️ برجاء كتابة سبب إلغاء الرحلة (لتنبيه أصحاب المحلات والعميل وتفادي أي عقوبات):',
        'مثال: عطل مفاجئ في الدراجة النارية / عطل بالسيارة',
        'إبلاغ عن حالة طارئة وإلغاء الرحلة 🚨'
    );
    if (!reason) return;

    try {
        for (const orderId of orderIds) {
            await api.orders.reportEmergency(token, orderId, reason);
        }
        await showBarakaAlert('تم إبلاغ النظام بنجاح وإعادة جميع الطلبات للوحة المتاحة لطيار آخر! سلامتك أولاً. ❤️', 'info', 'تم الإبلاغ 🚨');
        loadDriverOrders();
    } catch (error) {
        await showBarakaAlert('حدث خطأ أثناء الإبلاغ: ' + (error.detail || JSON.stringify(error)), 'warning', 'خطأ ⚠️');
    }
}


// ==========================================
// Shop Settlement OTP QR Code Modal
// ==========================================
window.showQrCodeForShopOtp = function(tripId, shopName, shopOtp) {
    const modalHtml = `
        <div class="modal fade" id="shopOtpQrModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-sm">
                <div class="modal-content border-0 rounded-4" style="background-color: var(--color-dune-light);">
                    <div class="modal-header border-0 pb-0 justify-content-between" style="direction: rtl;">
                        <h6 class="modal-title fw-bold text-espresso"><i class="bi bi-qr-code text-marigold me-1"></i>رمز QR لمحل ${shopName}</h6>
                        <button type="button" class="btn-close ms-0 me-auto" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4 text-center">
                        <div id="shop-otp-qrcode-container" class="d-flex justify-content-center mb-3"></div>
                        <div class="fw-bold text-espresso fs-5 mb-1" style="font-family: monospace; letter-spacing: 4px;">${shopOtp}</div>
                        <small class="text-muted">دع صاحب المحل يمسح الكود لتسوية الكاش تلقائياً 💰</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const existing = document.getElementById('shopOtpQrModal');
    if (existing) {
        const bsModal = bootstrap.Modal.getInstance(existing);
        if (bsModal) bsModal.dispose();
        existing.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('shopOtpQrModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    
    setTimeout(() => {
        const container = document.getElementById('shop-otp-qrcode-container');
        if (container && typeof QRCode !== 'undefined') {
            new QRCode(container, {
                text: shopOtp,
                width: 160,
                height: 160,
                colorDark : "#198754",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }
    }, 150);
}


// ==========================================
// Shop Settlement Postponement Action
// ==========================================
window.postponeShopSettlement = async function(orderId, shopId, shopName) {
    const confirmPostpone = await showBarakaConfirm(
        `هل تريد تأجيل سداد مستحقات محل (${shopName}) بسبب إغلاق المحل أو عدم تواجد صاحب المحل؟ \n\nسيقوم النظام بإخطار صاحب المحل وإيقاف مهلة الـ 5 ساعات لتجنب تعليق حسابك.`,
        'تأكيد تأجيل السداد 🚪'
    );
    if (!confirmPostpone) return;
    
    const token = localStorage.getItem('access_token');
    try {
        await api.orders.postponeShopSettlement(token, orderId, shopId);
        await showBarakaAlert(`تم تأجيل تصفية مستحقات محل (${shopName}) بنجاح وتجميد مهلة السداد لهذا المحل مؤقتاً!`, 'info', 'تم التأجيل بنجاح 🚪');
        loadDriverTrips(); // Reload trips
    } catch (error) {
        await showBarakaAlert('فشل تأجيل التسوية: ' + (error.detail || JSON.stringify(error)), 'warning', 'خطأ ⚠️');
    }
}
