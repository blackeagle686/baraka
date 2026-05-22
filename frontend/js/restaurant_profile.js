let currentRestaurantId = null;
let newRestImageFile = null;
let currentMenuItems = [];
let currentRestOrders = [];
let allCategories = [];

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token');
    const userRole = localStorage.getItem('user_role');

    if (!token || userRole !== 'RESTAURANT_OWNER') {
        window.location.href = '/html/index.html';
        return;
    }

    initRestProfile();
    loadMenuCategories();

    document.getElementById('restaurantForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleRestSubmit();
    });

    document.getElementById('menuItemForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleMenuItemSubmit();
    });

    document.getElementById('editMenuItemForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleMenuItemEditSubmit();
    });

    document.getElementById('deleteItemBtn')?.addEventListener('click', async () => {
        await handleMenuItemDelete();
    });

    document.getElementById('restImage')?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const max_size = 2 * 1024 * 1024;
            if (file.size > max_size) {
                alert('حجم الصورة كبير جداً! الحد الأقصى 2 ميجابايت.');
                e.target.value = '';
                return;
            }
            newRestImageFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('restImagePreview').innerHTML = `<img src="${e.target.result}" class="w-100 h-100 object-fit-cover" style="border-radius: 16px;">`;
            };
            reader.readAsDataURL(newRestImageFile);
        }
    });
});

async function loadMenuCategories() {
    try {
        allCategories = await api.menuCategories.getAll();
        populateCategoryDropdowns();
    } catch { allCategories = []; }
}

function populateCategoryDropdowns() {
    const selects = ['itemCategory', 'editItemCategory'];
    const html = '<option value="">اختر القسم</option>' +
        allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('') +
        '<option value="__new__">+ إضافة قسم جديد</option>';

    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
}

async function initRestProfile() {
    const token = localStorage.getItem('access_token');
    try {
        const restaurant = await api.restaurants.getMyRestaurant(token);
        if (restaurant) {
            currentRestaurantId = restaurant.id;
            populateRestForm(restaurant);
            loadMenuItems();
            loadRestOrders();
            startRestAutoRefresh();
        } else {
            document.getElementById('restSettingsTitle').innerText = 'إنشاء مطعم جديد';
            document.getElementById('noRestaurantRevenueState').classList.remove('d-none');
            initRestMap(null, null);
        }
    } catch (error) {
        console.error("Error fetching restaurant:", error);
    }
}

function populateRestForm(restaurant) {
    document.getElementById('restName').value = restaurant.name || '';
    document.getElementById('restDesc').value = restaurant.description || '';
    document.getElementById('restAddress').value = restaurant.address || '';
    document.getElementById('restLatitude').value = restaurant.latitude || '';
    document.getElementById('restLongitude').value = restaurant.longitude || '';
    document.getElementById('restOpeningTime').value = restaurant.opening_time ? restaurant.opening_time.substring(0, 5) : '';
    document.getElementById('restClosingTime').value = restaurant.closing_time ? restaurant.closing_time.substring(0, 5) : '';
    document.getElementById('restIsOpen').checked = restaurant.is_open;

    document.getElementById('sidebarRestName').innerText = restaurant.name || 'مطعمي';

    if (restaurant.image) {
        document.getElementById('restImagePreview').innerHTML = `<img src="${restaurant.image}" class="w-100 h-100 object-fit-cover" style="border-radius: 16px;">`;
    }

    initRestMap(restaurant.latitude, restaurant.longitude);
}

async function handleRestSubmit() {
    const token = localStorage.getItem('access_token');
    const saveBtn = document.getElementById('saveRestBtn');
    const statusMsg = document.getElementById('restStatusMsg');

    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ...';

    const formData = new FormData();
    formData.append('name', document.getElementById('restName').value);
    formData.append('description', document.getElementById('restDesc').value);
    formData.append('address', document.getElementById('restAddress').value);
    formData.append('latitude', document.getElementById('restLatitude').value || '');
    formData.append('longitude', document.getElementById('restLongitude').value || '');
    formData.append('opening_time', document.getElementById('restOpeningTime').value || '');
    formData.append('closing_time', document.getElementById('restClosingTime').value || '');
    formData.append('is_open', document.getElementById('restIsOpen').checked);

    if (newRestImageFile) formData.append('image', newRestImageFile);

    try {
        let saved;
        if (currentRestaurantId) {
            saved = await api.restaurants.updateRestaurant(token, currentRestaurantId, formData);
            statusMsg.innerText = 'تم تحديث المطعم بنجاح!';
        } else {
            saved = await api.restaurants.createRestaurant(token, formData);
            currentRestaurantId = saved.id;
            statusMsg.innerText = 'تم إنشاء المطعم بنجاح!';
            document.getElementById('restSettingsTitle').innerText = 'إعدادات المطعم';
            loadMenuItems();
            loadRestOrders();
        }
        statusMsg.className = 'text-success text-center fw-bold mt-2';
        statusMsg.classList.remove('d-none');
        populateRestForm(saved);
    } catch (error) {
        statusMsg.className = 'text-danger text-center fw-bold mt-2';
        statusMsg.innerText = 'خطأ: ' + JSON.stringify(error);
        statusMsg.classList.remove('d-none');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ بيانات المطعم';
        setTimeout(() => statusMsg.classList.add('d-none'), 5000);
    }
}

// ==========================================
// Menu Items Management
// ==========================================
async function loadMenuItems() {
    if (!currentRestaurantId) return;
    try {
        currentMenuItems = await api.restaurants.getMenuItems(currentRestaurantId);
        renderMenuItemsList(currentMenuItems);
        document.getElementById('statMenuItems').innerText = currentMenuItems.length;
    } catch (error) {
        console.error("Error loading menu items:", error);
    }
}

let currentMenuPage = 1;
const MENU_PAGE_SIZE = 6;

window.changeMenuPage = function(page) {
    currentMenuPage = page;
    renderMenuItemsList(currentMenuItems);
};

function renderMenuItemsList(items) {
    const container = document.getElementById('menuItemsList');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<div class="empty-state w-100 animate-up"><div class="empty-state-icon"><i class="bi bi-menu-button-wide"></i></div><p class="fw-bold">لا توجد أصناف</p><p class="small text-mesa">أضف أصنافك من الزر أعلاه</p></div>`;
        document.getElementById('menuItemsPagination').innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(items.length / MENU_PAGE_SIZE);
    if (currentMenuPage > totalPages) currentMenuPage = Math.max(1, totalPages);
    const start = (currentMenuPage - 1) * MENU_PAGE_SIZE;
    const end = Math.min(start + MENU_PAGE_SIZE, items.length);
    const sliced = items.slice(start, end);

    container.innerHTML = sliced.map(item => `
        <div class="col-md-6 mb-3">
            <div class="product-manage-card h-100 p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h6 class="fw-bold text-espresso mb-1">${item.name}</h6>
                        <p class="text-mesa small mb-2" style="font-size: 0.8rem;">${item.description || ''}</p>
                    </div>
                    <span class="badge ${item.available ? 'bg-success' : 'bg-danger'} rounded-pill">${item.available ? 'متاح' : 'غير متاح'}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="fw-bold" style="color: var(--restaurant-primary); font-size: 1.1rem;">${item.price} ج.م</span>
                        ${item.category_name ? `<span class="text-mesa small me-2"><i class="bi bi-tag me-1"></i>${item.category_name}</span>` : ''}
                    </div>
                    <button onclick="openEditMenuItemModal(${item.id})" class="btn btn-sm btn-outline-mesa rounded-pill px-3"><i class="bi bi-pencil me-1"></i>تعديل</button>
                </div>
            </div>
        </div>
    `).join('');

    if (window.renderClientPagination) {
        window.renderClientPagination('menuItemsPagination', items.length, currentMenuPage, MENU_PAGE_SIZE, 'window.changeMenuPage');
    }
}

window.openAddMenuItemModal = function() {
    document.getElementById('menuItemForm').reset();
    const modal = new bootstrap.Modal(document.getElementById('addMenuItemModal'));
    modal.show();
};

window.openEditMenuItemModal = function(id) {
    const item = currentMenuItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemDesc').value = item.description || '';
    document.getElementById('editItemAvailable').checked = item.available;

    const catSelect = document.getElementById('editItemCategory');
    if (item.category) catSelect.value = item.category;
    else if (catSelect.options.length > 0) catSelect.selectedIndex = 0;

    const modal = new bootstrap.Modal(document.getElementById('editMenuItemModal'));
    modal.show();
};

async function handleMenuItemSubmit() {
    const token = localStorage.getItem('access_token');
    if (!currentRestaurantId) { alert('يجب إنشاء مطعم أولاً'); return; }

    const formData = new FormData();
    formData.append('name', document.getElementById('itemName').value);
    formData.append('price', document.getElementById('itemPrice').value);
    formData.append('description', document.getElementById('itemDesc').value || '');
    formData.append('available', document.getElementById('itemAvailable').checked);

    const category = document.getElementById('itemCategory').value;
    if (category && category !== '__new__') formData.append('category', category);

    const imgFile = document.getElementById('itemImage').files[0];
    if (imgFile) formData.append('image', imgFile);

    try {
        await api.menuItems.create(token, formData);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('addMenuItemModal')).hide();
        document.getElementById('menuItemForm').reset();
        loadMenuItems();
        if (window.showBarakaToast) window.showBarakaToast('تم إضافة الصنف بنجاح!', 'success', 'bi-check-circle');
    } catch (error) {
        alert('حدث خطأ: ' + JSON.stringify(error));
    }
}

async function handleMenuItemEditSubmit() {
    const token = localStorage.getItem('access_token');
    const id = document.getElementById('editItemId').value;

    const formData = new FormData();
    formData.append('name', document.getElementById('editItemName').value);
    formData.append('price', document.getElementById('editItemPrice').value);
    formData.append('description', document.getElementById('editItemDesc').value || '');
    formData.append('available', document.getElementById('editItemAvailable').checked);

    const category = document.getElementById('editItemCategory').value;
    if (category && category !== '__new__') formData.append('category', category);

    try {
        await api.menuItems.update(token, id, formData);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('editMenuItemModal')).hide();
        loadMenuItems();
        if (window.showBarakaToast) window.showBarakaToast('تم تحديث الصنف بنجاح!', 'success', 'bi-check-circle');
    } catch (error) {
        alert('حدث خطأ: ' + JSON.stringify(error));
    }
}

async function handleMenuItemDelete() {
    const token = localStorage.getItem('access_token');
    const id = document.getElementById('editItemId').value;
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;

    try {
        await api.menuItems.delete(token, id);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('editMenuItemModal')).hide();
        loadMenuItems();
        if (window.showBarakaToast) window.showBarakaToast('تم حذف الصنف بنجاح!', 'success', 'bi-check-circle');
    } catch (error) {
        alert('حدث خطأ: ' + JSON.stringify(error));
    }
}

// ==========================================
// Orders Management
// ==========================================
let restOrderFilter = 'all';
let currentRestOrdersPage = 1;
const REST_ORDERS_PAGE_SIZE = 4;

window.filterRestOrders = function(filter, el) {
    restOrderFilter = filter;
    document.querySelectorAll('#orderFilterTabs .rest-filter-badge').forEach(b => {
        b.classList.remove('active');
    });
    if (el) el.classList.add('active');
    currentRestOrdersPage = 1;
    renderRestOrders(currentRestOrders);
};

window.changeRestOrdersPage = function(page) {
    currentRestOrdersPage = page;
    renderRestOrders(currentRestOrders);
};

async function loadRestOrders() {
    const token = localStorage.getItem('access_token');
    try {
        currentRestOrders = await api.orders.getAll(token);
        renderRestOrders(currentRestOrders);
        updateRestOrderStats(currentRestOrders);
    } catch (error) {
        console.error("Error loading orders:", error);
        const container = document.getElementById('restOrdersList');
        if (container) container.innerHTML = `<div class="text-danger text-center w-100">حدث خطأ أثناء تحميل الطلبات</div>`;
    }
}

function updateRestOrderStats(orders) {
    const active = orders.filter(o => ['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'].includes(o.status));
    document.getElementById('statTotalOrders').innerText = orders.length;
    document.getElementById('statActiveOrders').innerText = active.length;

    const badge = document.getElementById('sidebarOrderBadge');
    if (badge) {
        badge.innerText = active.length;
        badge.classList.toggle('d-none', active.length === 0);
    }
}

function renderRestOrders(orders) {
    const container = document.getElementById('restOrdersList');
    if (!container) return;

    // Filter to only restaurant orders
    const restOrders = orders.filter(o =>
        o.items?.some(i => i.menu_item_details)
    );

    let filtered = restOrders;
    if (restOrderFilter === 'active') {
        filtered = restOrders.filter(o => ['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'].includes(o.status));
    } else if (restOrderFilter === 'completed') {
        filtered = restOrders.filter(o => o.status === 'DELIVERED' || o.status === 'CANCELLED');
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state w-100 animate-up"><div class="empty-state-icon"><i class="bi bi-truck"></i></div><p class="fw-bold">لا توجد طلبات</p></div>`;
        document.getElementById('restOrdersPagination').innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(filtered.length / REST_ORDERS_PAGE_SIZE);
    if (currentRestOrdersPage > totalPages) currentRestOrdersPage = Math.max(1, totalPages);
    const start = (currentRestOrdersPage - 1) * REST_ORDERS_PAGE_SIZE;
    const end = Math.min(start + REST_ORDERS_PAGE_SIZE, filtered.length);
    const sliced = filtered.slice(start, end);

    container.innerHTML = sliced.map((order, idx) => {
        let statusClass = 'bg-warning text-dark', statusText = 'معلق';
        switch (order.status) {
            case 'PENDING': statusClass = 'bg-warning text-dark'; statusText = 'معلق'; break;
            case 'ACCEPTED': statusClass = 'bg-info text-dark'; statusText = 'مقبول'; break;
            case 'PREPARING': statusClass = 'bg-primary'; statusText = 'قيد التحضير'; break;
            case 'ON_DELIVERY': statusClass = 'bg-secondary'; statusText = 'في التوصيل'; break;
            case 'DELIVERED': statusClass = 'bg-success'; statusText = 'مكتمل'; break;
            case 'CANCELLED': statusClass = 'bg-danger'; statusText = 'ملغي'; break;
        }

        const menuItemNames = order.items.filter(i => i.menu_item_details).map(i =>
            `${i.menu_item_details.name} (x${i.quantity})`
        ).join('<br>');

        let actionsHtml = '';
        if (order.status === 'PENDING' || order.status === 'ACCEPTED') {
            actionsHtml = `
                <button onclick="updateRestOrderStatus(${order.id}, 'PREPARING')" class="btn btn-sm btn-primary rounded-pill px-3"><i class="bi bi-check-lg me-1"></i>بدء التحضير</button>
                <button onclick="updateRestOrderStatus(${order.id}, 'CANCELLED')" class="btn btn-sm btn-outline-danger rounded-pill px-2 ms-2">إلغاء</button>`;
        } else if (order.status === 'PREPARING') {
            actionsHtml = `<span class="badge bg-primary rounded-pill px-3 py-2">قيد التحضير</span>`;
        } else if (order.status === 'ON_DELIVERY') {
            actionsHtml = `<span class="badge bg-secondary rounded-pill px-3 py-2">في التوصيل</span>`;
        } else if (order.status === 'DELIVERED') {
            actionsHtml = `<span class="badge bg-success rounded-pill px-3 py-2"><i class="bi bi-check-circle me-1"></i>تم التوصيل</span>`;
        } else {
            actionsHtml = `<span class="text-muted small">تم الإلغاء</span>`;
        }

        const dateStr = new Date(order.created_at).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        return `
            <div class="col-md-6 mb-3 animate-up" style="animation-delay: ${idx * 0.05}s;">
                <div class="dashboard-card p-3 h-100 d-flex flex-column border" style="background: rgba(255,255,255,0.7); border-color: rgba(201,153,151,0.12) !important; border-radius: 16px;">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold text-espresso">طلب #${order.id}</span>
                        <span class="badge ${statusClass} rounded-pill px-2 py-1">${statusText}</span>
                    </div>
                    <div class="mb-2 small">
                        <div class="text-muted mb-1"><i class="bi bi-person me-1"></i>العميل: <strong>${order.customer_details?.name || order.customer_details?.phone || 'عميل'}</strong></div>
                        <div class="text-muted mb-1"><i class="bi bi-telephone me-1"></i>${order.customer_details?.phone || ''}</div>
                        <div class="text-muted mb-1"><i class="bi bi-geo-alt me-1"></i>${order.address || ''}</div>
                        <div class="text-muted mb-1"><i class="bi bi-bag me-1"></i>${menuItemNames}</div>
                        ${order.driver_details ? `<div class="text-muted mb-1"><i class="bi bi-bicycle me-1"></i>الطيار: ${order.driver_details.name || order.driver_details.phone}</div>` : ''}
                        <div class="fw-bold mt-2" style="color: var(--restaurant-primary);">${order.total_price} ج.م</div>
                        <div class="text-muted small">${dateStr}</div>
                    </div>
                    <div class="d-flex align-items-center mt-auto border-top pt-2">${actionsHtml}</div>
                </div>
            </div>`;
    }).join('');

    if (window.renderClientPagination) {
        window.renderClientPagination('restOrdersPagination', filtered.length, currentRestOrdersPage, REST_ORDERS_PAGE_SIZE, 'window.changeRestOrdersPage');
    }
}

window.updateRestOrderStatus = async function(orderId, newStatus) {
    const token = localStorage.getItem('access_token');
    try {
        await api.orders.updateStatus(token, orderId, newStatus);
        loadRestOrders();
        if (window.showBarakaToast) window.showBarakaToast('تم تحديث حالة الطلب!', 'success', 'bi-check-circle');
    } catch (error) {
        alert('حدث خطأ: ' + JSON.stringify(error));
    }
};

// ==========================================
// Auto-Refresh
// ==========================================
let restRefreshTimer = null;
let restRefreshSecondsLeft = 15;

function startRestAutoRefresh() {
    if (restRefreshTimer) clearInterval(restRefreshTimer);
    const indicator = document.getElementById('restAutoRefreshIndicator');
    const countdown = document.getElementById('restRefreshCountdown');
    if (!indicator || !countdown) return;

    indicator.style.display = 'flex';
    restRefreshSecondsLeft = 15;
    countdown.innerText = restRefreshSecondsLeft;

    restRefreshTimer = setInterval(() => {
        restRefreshSecondsLeft--;
        countdown.innerText = restRefreshSecondsLeft;
        if (restRefreshSecondsLeft <= 0) {
            clearInterval(restRefreshTimer);
            restRefreshTimer = null;
            loadRestOrders().finally(() => startRestAutoRefresh());
        }
    }, 1000);
}

window.manualRefreshRestOrders = function() {
    const icon = document.getElementById('restRefreshIcon');
    if (icon) icon.classList.add('bi-arrow-clockwise-spin');
    if (restRefreshTimer) { clearInterval(restRefreshTimer); restRefreshTimer = null; }
    loadRestOrders().finally(() => {
        if (icon) icon.classList.remove('bi-arrow-clockwise-spin');
        if (window.showBarakaToast) window.showBarakaToast('تم تحديث الطلبات!', 'success', 'bi-arrow-clockwise');
        startRestAutoRefresh();
    });
};

// ==========================================
// Map
// ==========================================
let restMapInstance = null;
let restMarkerInstance = null;

function initRestMap(lat, lon) {
    const latVal = parseFloat(lat) || 30.0444;
    const lonVal = parseFloat(lon) || 31.2357;
    const mapContainer = document.getElementById('restMap');
    if (!mapContainer) return;

    if (restMapInstance) {
        restMapInstance.setView([latVal, lonVal], 14);
        if (restMarkerInstance) restMarkerInstance.setLatLng([latVal, lonVal]);
        else {
            restMarkerInstance = L.marker([latVal, lonVal], { draggable: true }).addTo(restMapInstance);
            bindRestMarkerDrag();
        }
        return;
    }

    restMapInstance = L.map('restMap').setView([latVal, lonVal], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap contributors'
    }).addTo(restMapInstance);

    restMarkerInstance = L.marker([latVal, lonVal], { draggable: true }).addTo(restMapInstance);
    bindRestMarkerDrag();

    restMapInstance.on('click', (e) => {
        restMarkerInstance.setLatLng([e.latlng.lat, e.latlng.lng]);
        syncRestMapFields(e.latlng.lat, e.latlng.lng);
    });

    ['restLatitude', 'restLongitude'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', syncRestInputsToMap);
    });
}

function bindRestMarkerDrag() {
    if (restMarkerInstance) {
        restMarkerInstance.on('dragend', () => {
            const pos = restMarkerInstance.getLatLng();
            syncRestMapFields(pos.lat, pos.lng);
        });
    }
}

function syncRestMapFields(lat, lon) {
    const latInput = document.getElementById('restLatitude');
    const lonInput = document.getElementById('restLongitude');
    if (latInput) latInput.value = lat.toFixed(6);
    if (lonInput) lonInput.value = lon.toFixed(6);
}

function syncRestInputsToMap() {
    const lat = parseFloat(document.getElementById('restLatitude').value);
    const lon = parseFloat(document.getElementById('restLongitude').value);
    if (!isNaN(lat) && !isNaN(lon) && restMarkerInstance && restMapInstance) {
        restMarkerInstance.setLatLng([lat, lon]);
        restMapInstance.setView([lat, lon]);
    }
}
