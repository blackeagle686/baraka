let restMapInstance = null;
let restMarkersLayer = null;
let currentRestaurants = [];
let currentRestaurantId = null;
let restCart = [];
let restCurrentPage = 1;
const REST_PAGE_SIZE = 6;

document.addEventListener('DOMContentLoaded', () => {
    const isDetail = window.location.pathname.includes('/restaurants/details.html');
    if (isDetail) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) {
            currentRestaurantId = parseInt(id);
            initRestaurantDetails(currentRestaurantId);
        }
    } else {
        loadRestaurantsList();
    }
});

// ==========================================
// LIST MODE
// ==========================================
window.loadRestaurantsList = async function(page = 1) {
    restCurrentPage = page;
    const search = document.getElementById('restSearchInput')?.value || '';
    const container = document.getElementById('restaurantsListContainer');
    const pagination = document.getElementById('restaurantsPagination');
    if (!container) return;

    try {
        const data = await api.restaurants.getAll(page, search);
        currentRestaurants = data.results || data;
        renderRestaurantsList(currentRestaurants);

        if (data.count && window.renderClientPagination) {
            window.renderClientPagination('restaurantsPagination', data.count, page, REST_PAGE_SIZE, 'window.loadRestaurantsList');
        } else if (pagination) pagination.innerHTML = '';

        if (window.restMapInstance) {
            updateRestMapMarkers(currentRestaurants);
        } else {
            initRestMap(currentRestaurants);
        }
    } catch (error) {
        container.innerHTML = `<div class="text-center py-5 text-mesa"><i class="bi bi-exclamation-circle fs-1 mb-2 d-block"></i><p class="fw-bold">فشل تحميل قائمة المطاعم</p></div>`;
    }
};

function renderRestaurantsList(restaurants) {
    const container = document.getElementById('restaurantsListContainer');
    if (!container) return;

    if (!restaurants || restaurants.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 animate-up">
                <div style="font-size: 4rem; margin-bottom: 0.5rem;">\U0001f37d\ufe0f</div>
                <p class="fw-bold fs-5 text-espresso">لا توجد مطاعم متاحة</p>
                <p class="text-mesa small">لا يوجد مطاعم في قريتك حالياً. تابعنا قريباً!</p>
            </div>`;
        return;
    }

    container.innerHTML = restaurants.map(r => `
        <a href="/html/restaurants/details.html?id=${r.id}" class="text-decoration-none d-block mb-3 animate-up">
            <div class="restaurant-card-hover">
                <div style="position: relative;">
                    <img src="${r.image || '/images/restaurant-placeholder.png'}" class="restaurant-card-img" alt="${r.name}" onerror="this.src='/images/restaurant-placeholder.png'">
                    <span class="badge ${r.is_open ? 'bg-success' : 'bg-danger'} position-absolute top-0 end-0 m-2 rounded-pill px-2" style="font-size: 0.7rem;">${r.is_open ? 'مفتوح' : 'مغلق'}</span>
                </div>
                <div class="restaurant-card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <div class="restaurant-card-name">${r.name}</div>
                            <div class="restaurant-card-address"><i class="bi bi-geo-alt me-1"></i>${r.address || ''}</div>
                        </div>
                        ${r.average_rating > 0 ? `<div class="restaurant-card-rating"><i class="bi bi-star-fill me-1"></i>${r.average_rating}</div>` : ''}
                    </div>
                </div>
            </div>
        </a>
    `).join('');
}

// ==========================================
// MAP
// ==========================================
function initRestMap(restaurants) {
    if (document.getElementById('restMap')) {
        restMapInstance = L.map('restMap').setView([30.0444, 31.2357], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, attribution: '© OpenStreetMap'
        }).addTo(restMapInstance);
        updateRestMapMarkers(restaurants);
    }
}

function updateRestMapMarkers(restaurants) {
    if (!restMapInstance) return;
    if (restMarkersLayer) restMapInstance.removeLayer(restMarkersLayer);

    const validRestaurants = restaurants.filter(r => r.latitude && r.longitude);
    if (validRestaurants.length === 0) return;

    const bounds = [];
    restMarkersLayer = L.layerGroup().addTo(restMapInstance);

    validRestaurants.forEach(r => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng)) return;
        bounds.push([lat, lng]);

        const icon = L.divIcon({
            className: '',
            html: `<div class="restaurant-map-marker-icon restaurant-marker-pulse"><i class="bi bi-shop fs-6"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        L.marker([lat, lng], { icon })
            .addTo(restMarkersLayer)
            .bindPopup(`
                <div style="text-align: center; direction: rtl; font-family: 'Cairo', sans-serif;">
                    <strong style="color: var(--color-espresso);">${r.name}</strong><br>
                    <span style="font-size: 0.8rem; color: #666;">${r.address || ''}</span><br>
                    ${r.average_rating > 0 ? `<span style="color: #f59e0b;">★ ${r.average_rating}</span>` : ''}
                    <br><a href="/html/restaurants/details.html?id=${r.id}" class="btn btn-sm" style="background: var(--restaurant-primary, #f97316); color: white; border-radius: 100px; margin-top: 5px;">عرض المنيو</a>
                </div>
            `);
    });

    if (bounds.length > 0) restMapInstance.fitBounds(bounds, { padding: [30, 30] });
}

// ==========================================
// DETAIL MODE
// ==========================================
async function initRestaurantDetails(id) {
    try {
        const restaurant = await api.restaurants.getById(id);
        if (!restaurant) return;
        currentRestaurantId = restaurant.id;
        renderRestaurantDetail(restaurant);

        const items = restaurant.menu_items || await api.restaurants.getMenuItems(id);
        renderMenuItems(items);

        initRestaurantRatings(restaurant);
        loadRestCartFromStorage();
    } catch (error) {
        document.getElementById('restaurantDetailContent').innerHTML = `
            <div class="text-center py-5"><i class="bi bi-exclamation-triangle fs-1 text-danger mb-2 d-block"></i><p class="fw-bold">فشل تحميل بيانات المطعم</p></div>`;
    }
}

function renderRestaurantDetail(r) {
    document.title = `${r.name} - منصة بركة`;

    const coverBanner = document.querySelector('.rest-cover-banner');
    if (coverBanner) {
        const img = r.image || '/images/restaurant-placeholder.png';
        coverBanner.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url('${img}')`;
    }

    const header = document.getElementById('restCoverHeader');
    if (header) {
        const badges = `
            <div class="rest-cover-badges">
                <span class="rest-cover-badge-item">
                    <i class="bi ${r.is_open ? 'bi-check-circle' : 'bi-x-circle'}"></i>
                    ${r.is_open ? 'مفتوح' : 'مغلق'}
                </span>
                ${r.average_rating > 0 ? `
                    <span class="rest-cover-badge-item">
                        <i class="bi bi-star-fill" style="color: #f59e0b;"></i>
                        ${r.average_rating} (${r.total_ratings || 0})
                    </span>
                ` : ''}
                ${r.opening_time ? `
                    <span class="rest-cover-badge-item">
                        <i class="bi bi-clock"></i>
                        ${r.opening_time.substring(0,5)} - ${r.closing_time ? r.closing_time.substring(0,5) : ''}
                    </span>
                ` : ''}
                <span class="rest-cover-badge-item">
                    <i class="bi bi-geo-alt"></i>
                    ${r.address || ''}
                </span>
            </div>
        `;
        header.innerHTML = `
            <h1 class="rest-cover-title text-white fw-bold mb-2">${r.name}</h1>
            ${badges}
        `;
    }
}

function renderMenuItems(items) {
    const container = document.getElementById('menuItemsContainer');
    const tabsContainer = document.getElementById('menuCategoryTabs');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="text-center py-5 text-mesa"><p class="fw-bold">لا توجد أصناف في القائمة</p></div>`;
        return;
    }

    const categories = [...new Set(items.map(i => i.category_name || 'أخرى'))];
    tabsContainer.innerHTML = categories.map((cat, idx) =>
        `<span class="menu-category-tab ${idx === 0 ? 'active' : ''}" onclick="filterMenuByCategory('${cat}', this)">${cat}</span>`
    ).join('');

    renderFilteredMenuItems(items, categories[0]);
}

function renderFilteredMenuItems(items, category) {
    const container = document.getElementById('menuItemsContainer');
    if (!container) return;

    const filtered = category ? items.filter(i => (i.category_name || 'أخرى') === category) : items;
    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-mesa"><p>لا توجد أصناف في هذا القسم</p></div>`;
        return;
    }

    container.innerHTML = filtered.map(item => `
        <div class="menu-item-card mb-2 animate-up">
            <img src="${item.image || '/images/restaurant-placeholder.png'}" class="menu-item-img" onerror="this.src='/images/restaurant-placeholder.png'">
            <div class="menu-item-info">
                <div class="menu-item-name">${item.name}</div>
                ${item.description ? `<div class="menu-item-desc">${item.description}</div>` : ''}
                <div class="menu-item-price">${item.price} ج.م</div>
            </div>
            <button class="add-to-cart-btn ${!item.available ? 'disabled' : ''}" ${item.available ? `onclick="addToRestCart(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.price})"` : 'disabled'}>
                ${item.available ? '<i class="bi bi-plus-lg me-1"></i>أضف' : 'غير متاح'}
            </button>
        </div>
    `).join('');
}

window.filterMenuByCategory = function(category, el) {
    document.querySelectorAll('.menu-category-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    const items = window._allMenuItems || [];
    renderFilteredMenuItems(items, category);
};

// ==========================================
// CART
// ==========================================
function addToRestCart(itemId, itemName, itemPrice) {
    const existing = restCart.find(i => i.id === itemId);
    if (existing) {
        existing.qty += 1;
    } else {
        restCart.push({ id: itemId, name: itemName, price: itemPrice, qty: 1 });
    }
    saveRestCartToStorage();
    updateRestCartUI();
    if (window.showBarakaToast) {
        window.showBarakaToast(`تمت إضافة "${itemName}" للطلب!`, 'success', 'bi-check-circle');
    }
}

function removeFromRestCart(itemId) {
    restCart = restCart.filter(i => i.id !== itemId);
    saveRestCartToStorage();
    updateRestCartUI();
}

function changeRestCartQty(itemId, delta) {
    const item = restCart.find(i => i.id === itemId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) removeFromRestCart(itemId);
    else { saveRestCartToStorage(); updateRestCartUI(); }
}

function saveRestCartToStorage() {
    localStorage.setItem('baraka_rest_cart_' + currentRestaurantId, JSON.stringify(restCart));
}

function loadRestCartFromStorage() {
    try {
        const stored = localStorage.getItem('baraka_rest_cart_' + currentRestaurantId);
        if (stored) restCart = JSON.parse(stored);
        else restCart = [];
    } catch { restCart = []; }
    updateRestCartUI();
}

function updateRestCartUI() {
    const total = restCart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const count = restCart.reduce((sum, i) => sum + i.qty, 0);

    const sidebar = document.getElementById('restCheckoutItems');
    const totalEl = document.getElementById('restCheckoutTotal');
    const submitBtn = document.getElementById('restSubmitOrderBtn');
    const floatingBtn = document.getElementById('restFloatingCartBtn');
    const badge = document.getElementById('restCartCountBadge');

    if (sidebar) {
        if (restCart.length === 0) {
            sidebar.innerHTML = '<p class="text-mesa small text-center py-3">لم تختار أي أصناف بعد</p>';
        } else {
            sidebar.innerHTML = restCart.map(i => `
                <div class="d-flex justify-content-between align-items-center mb-2 pb-2" style="border-bottom: 1px solid rgba(201,153,151,0.1);">
                    <div>
                        <div class="fw-bold text-espresso small">${i.name}</div>
                        <div class="text-muted small">${i.price} ج.م × ${i.qty}</div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-outline-mesa rounded-circle p-0" style="width: 26px; height: 26px;" onclick="changeRestCartQty(${i.id}, -1)">−</button>
                        <span class="fw-bold small">${i.qty}</span>
                        <button class="btn btn-sm btn-outline-mesa rounded-circle p-0" style="width: 26px; height: 26px;" onclick="changeRestCartQty(${i.id}, 1)">+</button>
                        <button class="btn btn-sm text-danger p-0" onclick="removeFromRestCart(${i.id})"><i class="bi bi-trash3"></i></button>
                    </div>
                </div>
            `).join('');
        }
    }
    if (totalEl) totalEl.innerText = total.toFixed(2) + ' ج.م';
    if (submitBtn) submitBtn.style.display = count > 0 ? 'block' : 'none';
    if (floatingBtn) floatingBtn.style.display = count > 0 ? 'flex' : 'none';
    if (badge) badge.innerText = count;

    // Sync header cart count
    const headerCartCount = document.getElementById('headerCartCount');
    if (headerCartCount) {
        headerCartCount.dataset.restCount = count;
    }

    // Refresh modal body if modal is open
    const modalEl = document.getElementById('restCartModal');
    if (modalEl && modalEl.classList.contains('show')) {
        const body = document.getElementById('restCartModalBody');
        const footer = document.getElementById('restCartModalFooter');
        if (body) {
            body.innerHTML = `
                <div class="mb-3">
                    ${restCart.length === 0 ? '<p class="text-center text-mesa py-4">سلة الطلب فارغة</p>' :
                    restCart.map(i => `
                        <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-white rounded-3">
                            <div>
                                <div class="fw-bold text-espresso">${i.name}</div>
                                <div class="text-muted small">${i.price} ج.م</div>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <button class="btn btn-sm btn-outline-mesa rounded-circle p-0" style="width: 28px; height: 28px;" onclick="changeRestCartQty(${i.id}, -1)">−</button>
                                <span class="fw-bold">${i.qty}</span>
                                <button class="btn btn-sm btn-outline-mesa rounded-circle p-0" style="width: 28px; height: 28px;" onclick="changeRestCartQty(${i.id}, 1)">+</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold text-espresso small"><i class="bi bi-geo-alt me-1 text-marigold"></i>عنوان التوصيل</label>
                    <textarea class="form-control rounded-3 px-3 py-2" id="restOrderAddress" rows="2" placeholder="اكتب عنوان التوصيل..." ${!localStorage.getItem('access_token') ? 'disabled' : ''}>${localStorage.getItem('user_location') || ''}</textarea>
                </div>
            `;
        }
        if (footer) {
            const token = localStorage.getItem('access_token');
            footer.innerHTML = `
                <div class="w-100">
                    <div class="d-flex justify-content-between fw-bold text-espresso mb-2">
                        <span>الإجمالي</span>
                        <span style="color: var(--restaurant-primary);">${total.toFixed(2)} ج.م</span>
                    </div>
                    ${token ? `
                        <button class="btn w-100 rounded-pill fw-bold py-2 text-white" style="background: var(--restaurant-primary);" onclick="submitRestOrder()">
                            <i class="bi bi-check2 me-1"></i>تأكيد الطلب
                        </button>
                    ` : `
                        <a href="/html/auth/login.html" class="btn btn-primary w-100 rounded-pill fw-bold py-2">تسجيل الدخول للطلب</a>
                    `}
                </div>
            `;
        }
    }
}

window.openRestCartModal = function() {
    const modalEl = document.getElementById('restCartModal');
    const body = document.getElementById('restCartModalBody');
    const footer = document.getElementById('restCartModalFooter');
    if (!modalEl || !body) return;

    const total = restCart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const token = localStorage.getItem('access_token');

    body.innerHTML = `
        <div class="mb-3">
            ${restCart.length === 0 ? '<p class="text-center text-mesa py-4">سلة الطلب فارغة</p>' :
            restCart.map(i => `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-white rounded-3">
                    <div>
                        <div class="fw-bold text-espresso">${i.name}</div>
                        <div class="text-muted small">${i.price} ج.م</div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-outline-mesa rounded-circle p-0" style="width: 28px; height: 28px;" onclick="changeRestCartQty(${i.id}, -1)">−</button>
                        <span class="fw-bold">${i.qty}</span>
                        <button class="btn btn-sm btn-outline-mesa rounded-circle p-0" style="width: 28px; height: 28px;" onclick="changeRestCartQty(${i.id}, 1)">+</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="mb-3">
            <label class="form-label fw-bold text-espresso small"><i class="bi bi-geo-alt me-1 text-marigold"></i>عنوان التوصيل</label>
            <textarea class="form-control rounded-3 px-3 py-2" id="restOrderAddress" rows="2" placeholder="اكتب عنوان التوصيل..." ${!token ? 'disabled' : ''}>${localStorage.getItem('user_location') || ''}</textarea>
        </div>
    `;

    footer.innerHTML = `
        <div class="w-100">
            <div class="d-flex justify-content-between fw-bold text-espresso mb-2">
                <span>الإجمالي</span>
                <span style="color: var(--restaurant-primary);">${total.toFixed(2)} ج.م</span>
            </div>
            ${token ? `
                <button class="btn w-100 rounded-pill fw-bold py-2 text-white" style="background: var(--restaurant-primary);" onclick="submitRestOrder()">
                    <i class="bi bi-check2 me-1"></i>تأكيد الطلب
                </button>
            ` : `
                <a href="/html/auth/login.html" class="btn btn-primary w-100 rounded-pill fw-bold py-2">تسجيل الدخول للطلب</a>
            `}
        </div>
    `;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

async function submitRestOrder() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/html/auth/login.html';
        return;
    }

    const address = document.getElementById('restOrderAddress')?.value || localStorage.getItem('user_location') || '';
    if (!address) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى إدخال عنوان التوصيل.', 'warning', 'bi-exclamation-triangle');
        }
        return;
    }

    const menuItems = restCart.map(i => ({
        menu_item: i.id,
        quantity: i.qty
    }));

    try {
        const order = await api.orders.create(token, {
            address,
            menu_items: menuItems
        });

        localStorage.removeItem('baraka_rest_cart_' + currentRestaurantId);
        restCart = [];
        updateRestCartUI();

        const modalEl = document.getElementById('restCartModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();

        if (window.showBarakaToast) {
            window.showBarakaToast('تم تقديم طلبك بنجاح! جاري البحث عن طيار للتوصيل.', 'success', 'bi-check-circle');
        }

        setTimeout(() => {
            window.location.href = '/html/cart.html';
        }, 1500);
    } catch (error) {
        if (window.showBarakaToast) {
            window.showBarakaToast('حدث خطأ: ' + (error.detail || 'يرجى المحاولة مرة أخرى'), 'danger', 'bi-exclamation-triangle');
        }
    }
}

// ==========================================
// RATINGS
// ==========================================
async function initRestaurantRatings(restaurant) {
    const section = document.getElementById('restaurantRatingsSection');
    if (!section) return;

    const ratings = restaurant.ratings_list || [];
    let ratingsHtml = `
        <div class="restaurant-rating-card">
            <h6 class="fw-bold text-espresso mb-2"><i class="bi bi-star me-1" style="color: #f59e0b;"></i>التقييمات</h6>
    `;

    if (ratings.length > 0) {
        ratings.slice(0, 5).forEach(r => {
            ratingsHtml += `
                <div class="d-flex justify-content-between align-items-start mb-2 pb-2" style="border-bottom: 1px solid rgba(201,153,151,0.08);">
                    <div>
                        <div class="fw-bold small text-espresso">${r.customer_name || r.customer_phone || 'مستخدم'}</div>
                        <div class="restaurant-stars small">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                        ${r.review ? `<div class="text-mesa small mt-1">${r.review}</div>` : ''}
                    </div>
                </div>
            `;
        });
    } else {
        ratingsHtml += `<p class="text-mesa small text-center py-2">لا توجد تقييمات بعد</p>`;
    }

    const token = localStorage.getItem('access_token');
    if (token) {
        try {
            const status = await api.restaurants.getRatingStatus(token, restaurant.id);
            if (status.can_rate) {
                ratingsHtml += `
                    <hr>
                    <p class="fw-bold small text-espresso mb-2">قيم المطعم</p>
                    <div class="restaurant-stars mb-2" id="restRateStars">
                        ${[1,2,3,4,5].map(n => `<i class="bi bi-star" data-val="${n}" style="cursor: pointer;" onclick="setRestRating(${n})"></i>`).join('')}
                    </div>
                    <textarea class="form-control rounded-3 px-3 py-2 small mb-2" id="restReviewText" rows="2" placeholder="اكتب رأيك...">${status.existing_rating?.review || ''}</textarea>
                    <button class="btn btn-sm w-100 rounded-pill fw-bold text-white" style="background: var(--restaurant-primary);" onclick="submitRestRating(${restaurant.id})">
                        <i class="bi bi-send me-1"></i>إرسال التقييم
                    </button>
                `;
                if (status.existing_rating) {
                    setRestRating(status.existing_rating.rating);
                }
            }
        } catch {}
    }

    ratingsHtml += `</div>`;
    section.innerHTML = ratingsHtml;
}

let selectedRestRating = 0;

window.setRestRating = function(val) {
    selectedRestRating = val;
    document.querySelectorAll('#restRateStars i').forEach(el => {
        const starVal = parseInt(el.dataset.val);
        el.className = starVal <= val ? 'bi bi-star-fill' : 'bi bi-star';
    });
};

window.submitRestRating = async function(restaurantId) {
    const token = localStorage.getItem('access_token');
    if (!token || selectedRestRating === 0) return;

    const review = document.getElementById('restReviewText')?.value || '';
    try {
        await api.restaurants.rateRestaurant(token, restaurantId, selectedRestRating, review);
        if (window.showBarakaToast) {
            window.showBarakaToast('تم إرسال تقييمك بنجاح!', 'success', 'bi-check-circle');
        }
    } catch (error) {
        if (window.showBarakaToast) {
            window.showBarakaToast(error.detail || 'حدث خطأ', 'danger', 'bi-exclamation-triangle');
        }
    }
};
