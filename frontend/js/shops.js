document.addEventListener('DOMContentLoaded', () => {
    const isDetailsPage = window.location.pathname.includes('details.html');
    
    if (isDetailsPage) {
        initShopDetails();
    } else {
        initShopsList();
    }
});

async function initShopsList() {
    try {
        const shops = await api.shops.getAll();
        renderAllShops(shops);
        renderShopsMap(shops);
    } catch (error) {
        console.error("Error fetching shops:", error);
    }
}

function renderAllShops(shops) {
    const container = document.getElementById('allShopsList');
    if (!container) return;

    container.innerHTML = '';
    
    if (shops.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up">
                <div class="empty-state-icon"><i class="bi bi-shop"></i></div>
                <p class="fw-bold">لا توجد محلات حالياً</p>
                <p class="small text-mesa">ترقب... المحلات قادمة قريباً!</p>
            </div>`;
        return;
    }

    shops.forEach((shop, i) => {
        const shopHtml = `
            <div class="col-lg-3 col-md-4 col-sm-6 animate-up" style="animation-delay: ${i * 0.08}s;">
                <a href="/html/shops/details.html?id=${shop.id}" class="text-decoration-none">
                    <div class="shop-card h-100">
                        <div class="shop-img-placeholder">
                            ${shop.image ? `<img src="${shop.image}" class="w-100 h-100 object-fit-cover">` : `<span>${shop.name.charAt(0)}</span>`}
                        </div>
                        <div class="card-body text-center p-3">
                            <h6 class="fw-bold text-espresso mb-2">${shop.name}</h6>
                            <span class="btn btn-outline-primary btn-sm rounded-pill w-100">
                                <i class="bi bi-box-seam me-1"></i>عرض المنتجات
                            </span>
                        </div>
                    </div>
                </a>
            </div>
        `;
        container.innerHTML += shopHtml;
    });
}

async function initShopDetails() {
    const params = new URLSearchParams(window.location.search);
    const shopId = params.get('id');
    
    if(shopId) {
        try {
            const shop = await api.shops.getById(shopId);
            renderShopHeader(shop);
            
            const products = await api.shops.getProducts(shopId);
            renderShopProducts(products);
        } catch (error) {
            console.error("Error:", error);
            document.getElementById('shopHeader').innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-exclamation-triangle text-danger fs-1"></i>
                    <h4 class="text-danger mt-2">حدث خطأ أثناء تحميل المحل</h4>
                </div>`;
        }
    } else {
        document.getElementById('shopHeader').innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-question-circle text-mesa fs-1"></i>
                <h4 class="text-mesa mt-2">محل غير معروف</h4>
            </div>`;
    }
}

function renderShopHeader(shop) {
    const header = document.getElementById('shopHeader');
    if (!header) return;

    header.innerHTML = `
        <div class="d-flex align-items-center justify-content-center flex-column animate-up">
            ${shop.image 
                ? `<img src="${shop.image}" class="rounded-circle mb-3 shadow-lg" style="width:110px;height:110px;object-fit:cover;border:4px solid rgba(255,255,255,0.8);">` 
                : `<div class="rounded-circle mb-3 d-flex align-items-center justify-content-center text-white fs-1 shadow-lg" style="width:110px;height:110px;background:linear-gradient(135deg, var(--color-terracotta), var(--color-mesa));border:4px solid rgba(255,255,255,0.8);">${shop.name.charAt(0)}</div>`
            }
            <h2 class="shop-detail-name">${shop.name}</h2>
            <p class="text-mesa mb-2">${shop.description || ''}</p>
            <div class="shop-meta">
                <div class="shop-meta-item">
                    <i class="bi bi-geo-alt-fill text-marigold"></i>
                    <span>${shop.address || 'غير محدد'}</span>
                </div>
                <div class="shop-meta-item">
                    <span class="badge ${shop.is_open ? 'status-open' : 'status-closed'} rounded-pill px-3 py-2">
                        <i class="bi ${shop.is_open ? 'bi-check-circle' : 'bi-x-circle'} me-1"></i>
                        ${shop.is_open ? 'مفتوح الآن' : 'مغلق'}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function renderShopProducts(products) {
    const container = document.getElementById('productsList');
    if (!container) return;

    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up">
                <div class="empty-state-icon"><i class="bi bi-box-seam"></i></div>
                <p class="fw-bold">لا توجد منتجات متوفرة حالياً</p>
            </div>`;
        return;
    }

    products.forEach((product, i) => {
        const html = `
            <div class="col-lg-3 col-md-4 col-sm-6 animate-up" style="animation-delay: ${i * 0.06}s;">
                <div class="product-card h-100">
                    ${product.image 
                        ? `<img src="${product.image}" class="product-img">` 
                        : `<div class="product-img-placeholder"><i class="bi bi-image"></i></div>`
                    }
                    <div class="card-body p-3">
                        <p class="product-name">${product.name}</p>
                        <p class="text-mesa small mb-2" style="min-height: 2rem;">${product.description || ''}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="product-price">${product.price} ج.م</span>
                            ${product.available 
                                ? `<button onclick="addToCart(${product.id}, '${product.name}', ${product.price})" class="btn btn-marigold btn-sm rounded-pill px-3 fw-bold">
                                       <i class="bi bi-cart-plus me-1"></i>أضف
                                   </button>`
                                : `<span class="badge bg-danger rounded-pill small">غير متوفر</span>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// ==========================================
// Client-side Cart & Order Checkout System
// ==========================================
let cart = [];

window.addToCart = function(id, name, price) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('يرجى تسجيل الدخول أولاً لتتمكن من الطلب.');
        window.location.href = '/html/auth/login.html';
        return;
    }
    
    const existing = cart.find(it => it.product === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ product: id, name: name, price: price, quantity: 1 });
    }
    updateCartUI();
    
    // Visual indicator of item added
    const btn = document.querySelector(`[onclick*="addToCart(${id}"]`);
    if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>تم!`;
        btn.className = 'btn btn-success btn-sm rounded-pill px-3 fw-bold';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.className = 'btn btn-marigold btn-sm rounded-pill px-3 fw-bold';
        }, 1500);
    }
}

function updateCartUI() {
    const floatingBtn = document.getElementById('floatingCartBtn');
    const badge = document.getElementById('cartCountBadge');
    if (!floatingBtn || !badge) return;
    
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (totalQty > 0) {
        floatingBtn.classList.remove('d-none');
        badge.innerText = totalQty;
    } else {
        floatingBtn.classList.add('d-none');
    }
}

window.openCartModal = function() {
    const itemsList = document.getElementById('cartItemsList');
    const totalPriceEl = document.getElementById('cartTotalPrice');
    if (!itemsList || !totalPriceEl) return;
    
    itemsList.innerHTML = '';
    
    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        itemsList.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                <div>
                    <h6 class="fw-bold text-espresso mb-0">${item.name}</h6>
                    <small class="text-muted">${item.price} ج.م</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-outline-secondary rounded-circle py-0 px-2" onclick="changeQuantity(${item.product}, -1)">-</button>
                    <span class="fw-bold">${item.quantity}</span>
                    <button class="btn btn-sm btn-outline-secondary rounded-circle py-0 px-2" onclick="changeQuantity(${item.product}, 1)">+</button>
                    <button class="btn btn-sm btn-link text-danger ms-2 p-0" onclick="removeFromCart(${item.product})"><i class="bi bi-trash3"></i></button>
                </div>
            </div>
        `;
    });
    
    totalPriceEl.innerText = `${total.toFixed(2)} ج.م`;
    
    // Set user location as default address if available
    const token = localStorage.getItem('access_token');
    if (token) {
        api.auth.getProfile(token).then(profile => {
            if (profile.location) {
                document.getElementById('orderAddress').value = profile.location;
            }
        }).catch(err => console.error("Error fetching profile for address:", err));
    }
    
    const modal = new bootstrap.Modal(document.getElementById('cartModal'));
    modal.show();
}

window.changeQuantity = function(productId, delta) {
    const item = cart.find(it => it.product === productId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCartUI();
            // Re-render modal contents
            const itemsList = document.getElementById('cartItemsList');
            const totalPriceEl = document.getElementById('cartTotalPrice');
            if (itemsList && totalPriceEl) {
                itemsList.innerHTML = '';
                let total = 0;
                cart.forEach(it => {
                    const itemTotal = it.price * it.quantity;
                    total += itemTotal;
                    itemsList.innerHTML += `
                        <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                            <div>
                                <h6 class="fw-bold text-espresso mb-0">${it.name}</h6>
                                <small class="text-muted">${it.price} ج.م</small>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <button class="btn btn-sm btn-outline-secondary rounded-circle py-0 px-2" onclick="changeQuantity(${it.product}, -1)">-</button>
                                <span class="fw-bold">${it.quantity}</span>
                                <button class="btn btn-sm btn-outline-secondary rounded-circle py-0 px-2" onclick="changeQuantity(${it.product}, 1)">+</button>
                                <button class="btn btn-sm btn-link text-danger ms-2 p-0" onclick="removeFromCart(${it.product})"><i class="bi bi-trash3"></i></button>
                            </div>
                        </div>
                    `;
                });
                totalPriceEl.innerText = `${total.toFixed(2)} ج.م`;
            }
        }
    }
}

window.removeFromCart = function(productId) {
    cart = cart.filter(it => it.product !== productId);
    updateCartUI();
    
    if (cart.length === 0) {
        const modalEl = document.getElementById('cartModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    } else {
        window.changeQuantity(null, 0); // Trigger visual refresh
    }
}

window.submitOrder = async function() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    const address = document.getElementById('orderAddress').value.trim();
    if (!address) {
        alert('يرجى تحديد عنوان التوصيل أولاً.');
        return;
    }
    
    const params = new URLSearchParams(window.location.search);
    const shopId = params.get('id');
    
    const submitBtn = document.getElementById('submitOrderBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = 'جاري إرسال الطلب...';
    
    const orderData = {
        shop: parseInt(shopId),
        address: address,
        items: cart.map(it => ({ product: it.product, quantity: it.quantity }))
    };
    
    try {
        await api.orders.create(token, orderData);
        alert('تم إرسال طلبك بنجاح! سيقوم المحل بمراجعته فوراً.');
        
        cart = [];
        updateCartUI();
        
        const modalEl = document.getElementById('cartModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    } catch (error) {
        alert('حدث خطأ أثناء إرسال الطلب: ' + JSON.stringify(error));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'إرسال الطلب للمحل';
    }
}

// ==========================================
// Interactive Pinned Shops Map Directory
// ==========================================
let directoryMapInstance = null;
let directoryMarkersGroup = [];

function renderShopsMap(shops) {
    const mapContainer = document.getElementById('shopsDirectoryMap');
    if (!mapContainer) return;

    // Filter only shops that have a valid coordinate assigned
    const pinnedShops = shops.filter(shop => shop.latitude && shop.longitude);

    // Update count indicator
    const countBadge = document.getElementById('activeShopsMapCount');
    if (countBadge) {
        countBadge.innerText = `${pinnedShops.length} محلات محددة على الخريطة`;
    }

    if (pinnedShops.length === 0) {
        mapContainer.innerHTML = `
            <div class="d-flex align-items-center justify-content-center h-100 bg-light text-muted">
                <div class="text-center py-5">
                    <i class="bi bi-geo-alt-fill fs-1 text-mesa mb-2 animate-up"></i>
                    <p class="mb-0 fw-bold">لا توجد محلات محددة على الخريطة حالياً</p>
                    <p class="small text-mesa mt-1">تصفح المحلات المتاحة في القائمة بالأسفل</p>
                </div>
            </div>`;
        return;
    }

    // Centering default on the first pinned shop
    const defaultLat = parseFloat(pinnedShops[0].latitude);
    const defaultLon = parseFloat(pinnedShops[0].longitude);

    if (directoryMapInstance) {
        // Reset markers
        directoryMarkersGroup.forEach(marker => directoryMapInstance.removeLayer(marker));
        directoryMarkersGroup = [];
    } else {
        // Initialize Map
        directoryMapInstance = L.map('shopsDirectoryMap').setView([defaultLat, defaultLon], 13);

        // Load premium tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(directoryMapInstance);
    }

    const bounds = [];

    pinnedShops.forEach(shop => {
        const lat = parseFloat(shop.latitude);
        const lon = parseFloat(shop.longitude);
        bounds.push([lat, lon]);

        // Custom high-fidelity popup layout matching Egypt warm dune brand
        const popupContent = `
            <div class="shop-map-popup text-end" style="font-family: 'Cairo', sans-serif; direction: rtl;">
                <div class="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom" style="border-color: rgba(201,153,151,0.12) !important;">
                    <div style="width: 45px; height: 45px; border-radius: 50%; overflow: hidden; background: #eee; flex-shrink: 0; border: 2px solid rgba(194, 146, 64, 0.15);">
                        ${shop.image 
                            ? `<img src="${shop.image}" style="width:100%; height:100%; object-fit:cover;">` 
                            : `<div class="d-flex align-items-center justify-content-center h-100 text-white fw-bold" style="background: linear-gradient(135deg, var(--color-terracotta), var(--color-mesa)); font-size: 0.9rem;">${shop.name.charAt(0)}</div>`
                        }
                    </div>
                    <div>
                        <h6 class="fw-bold text-espresso m-0" style="font-size: 0.95rem;">${shop.name}</h6>
                        <span class="badge ${shop.is_open ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill px-2 py-0.5 mt-1" style="font-size: 0.7rem;">
                            ${shop.is_open ? 'مفتوح الآن' : 'مغلق'}
                        </span>
                    </div>
                </div>
                <p class="text-mesa small mb-2" style="max-height: 3rem; overflow: hidden; font-size: 0.8rem;">${shop.description || 'لا يوجد وصف متاح للمحل.'}</p>
                <div class="text-muted small mb-3" style="font-size: 0.8rem;"><i class="bi bi-geo-alt-fill text-marigold me-1"></i>${shop.address}</div>
                <a href="/html/shops/details.html?id=${shop.id}" class="btn btn-marigold btn-sm rounded-pill w-100 py-2 fw-bold text-white shadow-sm text-decoration-none">
                    <i class="bi bi-box-arrow-in-left me-1"></i>دخول المحل
                </a>
            </div>
        `;

        // Create Pin Marker
        const marker = L.marker([lat, lon]).addTo(directoryMapInstance)
            .bindPopup(popupContent, { minWidth: 220, closeButton: true });

        directoryMarkersGroup.push(marker);
    });

    // Fit map bounds smoothly to fit all active shop pins
    if (bounds.length > 0) {
        directoryMapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
}
