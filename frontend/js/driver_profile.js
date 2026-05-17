document.addEventListener('DOMContentLoaded', () => {
    initDriverDashboard();
});

let currentDriver = null;
let driverMapInstance = null;
let driverMarkerInstance = null;

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
        
        // Load orders data
        await loadDriverOrders();

        // Bind form save event
        const profileForm = document.getElementById('driverProfileForm');
        profileForm.addEventListener('submit', handleDriverProfileSubmit);

    } catch (error) {
        console.error("Initialization error:", error);
        localStorage.clear();
        window.location.href = '/html/auth/login.html';
    }
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
        const myActiveTrips = orders.filter(o => o.driver == currentDriver.id && (['ON_DELIVERY', 'ACCEPTED', 'PREPARING'].includes(o.status) || (o.status === 'DELIVERED' && !o.is_paid_to_shop)));
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

function renderAvailableOrders(orders) {
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
        return;
    }

    orders.forEach((order, i) => {
        const dateFormatted = new Date(order.created_at).toLocaleString('ar-EG', {
            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
        });

        // Calculate max allowed delivery fee: minimum 15, max 2% of total order price
        const maxAllowedPrice = Math.max(15.00, parseFloat(order.total_price) * 0.02).toFixed(2);

        // Items summary list
        const itemsList = order.items.map(it => `
            <div class="d-flex justify-content-between text-muted small py-1">
                <span>- ${it.product_details ? it.product_details.name : 'منتج'} (x${it.quantity})</span>
            </div>
        `).join('');

        const html = `
            <div class="col-md-6 mb-3 animate-up" style="animation-delay: ${i * 0.05}s;">
                <div class="dashboard-card p-3 h-100 d-flex flex-column border" style="background-color: rgba(255,255,255,0.7); border-color: rgba(201,153,151,0.12) !important;">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="fw-bold text-espresso">الطلب #${order.id}</span>
                        <span class="badge bg-warning-subtle text-warning rounded-pill px-2 py-1">${order.status === 'PREPARING' ? 'قيد التحضير بالمحل' : 'مقبول وينتظر طيار'}</span>
                    </div>

                    <div class="mb-3">
                        <div class="text-muted small mb-1"><i class="bi bi-shop me-1"></i>من محل: <strong class="text-espresso">${order.shop_details ? order.shop_details.name : 'محل بركة'}</strong> (${order.shop_details ? order.shop_details.address : ''})</div>
                        <div class="text-muted small mb-1"><i class="bi bi-geo-alt me-1"></i>توصيل إلى: <strong class="text-espresso">${order.address || 'العنوان المفتوح'}</strong></div>
                        <div class="text-muted small mb-2"><i class="bi bi-clock me-1"></i>وقت الطلب: ${dateFormatted}</div>
                    </div>

                    <div class="bg-white rounded-3 p-2 mb-3 flex-grow-1" style="border: 1px solid rgba(201,153,151,0.08);">
                        <div class="text-muted small mb-2 border-bottom pb-1 fw-bold">المنتجات المطلوب نقلها:</div>
                        ${itemsList}
                        <div class="d-flex justify-content-between align-items-center mt-2 fw-bold text-espresso pt-1">
                            <span>حساب المنتجات بالمحل:</span>
                            <span class="text-marigold">${order.total_price} ج.م</span>
                        </div>
                    </div>

                    <!-- Custom Delivery Price input section -->
                    <div class="mb-3">
                        <label class="form-label text-espresso small fw-bold mb-1"><i class="bi bi-cash-stack me-1 text-marigold"></i>سعر التوصيل الذي تطلبه (ج.م):</label>
                        <input type="number" class="form-control rounded-pill px-3 py-1 mb-1" id="deliveryPriceInput-${order.id}" value="15" min="15" max="${maxAllowedPrice}" step="1">
                        <span class="d-block text-muted px-2" style="font-size: 0.72rem; line-height: 1.2;">
                            <i class="bi bi-info-circle me-1 text-marigold"></i>الحد الأدنى: <strong>15 ج.م</strong> | الحد الأقصى (2%): <strong>${maxAllowedPrice} ج.م</strong>
                        </span>
                    </div>

                    <button class="btn btn-primary rounded-pill w-100 py-2 fw-bold mt-auto" onclick="acceptDeliveryTrip(${order.id})">
                        <i class="bi bi-check2-circle me-1"></i>قبول الطلب وتحديد سعر التوصيل
                    </button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderActiveTrips(trips) {
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
        return;
    }

    trips.forEach((trip, i) => {
        const dateFormatted = new Date(trip.created_at).toLocaleString('ar-EG', {
            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
        });
        
        const isDisputed = (trip.dispute_status === 'PENDING');
        const isDeliveredUnpaid = (trip.status === 'DELIVERED' && !trip.is_paid_to_shop);
        
        let statusBadgeHtml = `<span class="badge bg-success-subtle text-success rounded-pill px-2 py-1">جاري التوصيل للعميل</span>`;
        if (isDisputed) {
            statusBadgeHtml = `<span class="badge bg-danger text-white rounded-pill px-2 py-1">قيد النزاع ⚠️</span>`;
        } else if (isDeliveredUnpaid) {
            statusBadgeHtml = `<span class="badge bg-danger-subtle text-danger rounded-pill px-2 py-1">بانتظار سداد الحساب للمحل</span>`;
        }

        let cardTitle = `رحلة نشطة #${trip.id}`;
        if (isDisputed) {
            cardTitle = `رحلة متنازع عليها #${trip.id}`;
        } else if (isDeliveredUnpaid) {
            cardTitle = `رحلة مكتملة بانتظار السداد #${trip.id}`;
        }

        let actionHtmlBlock = `
            <button class="btn btn-success flex-grow-1 rounded-pill py-2 fw-bold" onclick="completeDeliveryTrip(${trip.id})">
                <i class="bi bi-check2-all me-1"></i>تم التوصيل بنجاح للعميل
            </button>
        `;
        if (isDisputed) {
            actionHtmlBlock = `
                <div class="alert alert-danger text-center py-2 rounded-pill small mb-0 fw-bold border-0" style="background-color: rgba(220,53,69,0.08); color: var(--color-terracotta);">
                    <i class="bi bi-exclamation-circle me-1"></i>الطلب قيد النزاع والمراجعة. جاري التحقق للفصل بين الطرفين.
                </div>
            `;
        } else if (isDeliveredUnpaid) {
            actionHtmlBlock = `
                <div class="alert alert-danger text-center py-3 rounded-4 mb-2 border-0 fw-bold shadow-sm" style="background-color: rgba(220,53,69,0.06); color: var(--color-terracotta);">
                    <div class="mb-1"><i class="bi bi-exclamation-triangle-fill me-1"></i>يرجى سداد ${trip.total_price} ج.م للمحل لتصفية الحساب.</div>
                    <div class="mt-2 p-2 bg-white rounded-3 border text-espresso text-center">
                        <span class="small text-mesa d-block mb-1">اعطِ هذا الرمز لصاحب المحل بعد الدفع:</span>
                        <strong class="fs-4 text-success tracking-wide" style="font-family: monospace; letter-spacing: 4px;">${trip.driver_otp || '----'}</strong>
                    </div>
                </div>
                <button onclick="raiseDriverDispute(${trip.id})" class="btn btn-sm btn-outline-danger rounded-pill w-100 mt-1">
                    <i class="bi bi-exclamation-octagon me-1"></i>تقديم شكوى / نزاع مع المحل
                </button>
            `;
        }

        const itemsList = trip.items.map(it => `
            <div class="d-flex justify-content-between text-muted small py-1">
                <span>- ${it.product_details ? it.product_details.name : 'منتج'} (x${it.quantity})</span>
            </div>
        `).join('');

        const html = `
            <div class="col-md-6 mb-3 animate-up" style="animation-delay: ${i * 0.05}s;">
                <div class="dashboard-card p-3 h-100 d-flex flex-column border" style="background-color: rgba(255,255,255,0.7); border-color: rgba(201,153,151,0.12) !important;">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="fw-bold text-espresso">${cardTitle}</span>
                        ${statusBadgeHtml}
                    </div>

                    <div class="mb-3">
                        <div class="text-muted small mb-1"><i class="bi bi-shop me-1"></i>استلام من: <strong class="text-espresso">${trip.shop_details ? trip.shop_details.name : 'محل بركة'}</strong> (${trip.shop_details ? trip.shop_details.address : ''})</div>
                        <div class="text-muted small mb-1"><i class="bi bi-person me-1"></i>اسم العميل: <strong class="text-espresso">${trip.customer_details ? trip.customer_details.name : 'عميل بركة'}</strong> (${trip.customer_details ? trip.customer_details.phone : ''})</div>
                        <div class="text-muted small mb-1"><i class="bi bi-geo-alt me-1"></i>عنوان العميل: <strong class="text-espresso">${trip.address || 'العنوان الافتراضي'}</strong></div>
                        <div class="text-muted small mb-2"><i class="bi bi-clock me-1"></i>تاريخ الاستلام: ${dateFormatted}</div>
                    </div>

                    <div class="bg-white rounded-3 p-2 mb-3 flex-grow-1" style="border: 1px solid rgba(201,153,151,0.08);">
                        <div class="text-muted small mb-2 border-bottom pb-1 fw-bold">المنتجات المطلوب نقلها:</div>
                        ${itemsList}
                        <div class="d-flex justify-content-between align-items-center mt-2 fw-bold text-espresso pt-1">
                            <span>حساب المحل:</span>
                            <span class="text-marigold">${trip.total_price} ج.م</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-1 fw-bold text-success pt-1 border-top" style="border-color: rgba(201,153,151,0.05) !important;">
                            <span>خدمة توصيل طيار:</span>
                            <span>${trip.delivery_price} ج.م</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-1 fw-bold text-espresso pt-1 border-top" style="border-color: rgba(201,153,151,0.1) !important;">
                            <span>إجمالي المطلوب من العميل:</span>
                            <span class="text-marigold">${(parseFloat(trip.total_price) + parseFloat(trip.delivery_price)).toFixed(2)} ج.م</span>
                        </div>
                    </div>

                    <div class="d-flex gap-2">
                        ${actionHtmlBlock}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
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

window.completeDeliveryTrip = async function(orderId) {
    const token = localStorage.getItem('access_token');
    const customerOtp = await showBarakaPrompt('برجاء إدخال رمز التحقق المستلم من العميل (المكون من 4 أرقام) لتأكيد تسليم الطلب واستلام الكاش:', 'مثال: 1234', 'تأكيد التسليم للعميل 📦');
    if (!customerOtp) return;
    
    try {
        await api.orders.updateStatus(token, orderId, 'DELIVERED', { customer_otp: customerOtp });
        await showBarakaAlert('تم التحقق من رمز العميل وتأكيد التوصيل بنجاح!', 'info', 'تم التوصيل 🎉');
        loadDriverOrders();
    } catch (error) {
        await showBarakaAlert('حدث خطأ أثناء إكمال التوصيل: ' + (error.detail || JSON.stringify(error)), 'warning', 'خطأ في التوصيل ⚠️');
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
