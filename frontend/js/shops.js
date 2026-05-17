document.addEventListener('DOMContentLoaded', () => {
    const isDetailsPage = window.location.pathname.includes('details.html');
    
    if (isDetailsPage) {
        initShopDetails();
    } else {
        initShopsList();
    }
});

let allFetchedShops = [];
let currentPage = 1;
let currentSearch = '';
let isOpenFilter = false;
let searchDebounceTimer = null;

async function initShopsList(page = 1) {
    try {
        currentPage = page;
        const response = await api.shops.getAll(currentPage, currentSearch);
        
        // Handle paginated responses
        const shops = response.results || response;
        allFetchedShops = shops;
        
        renderFilteredShops();
        renderShopsMap(shops);
        renderPagination(response);
        setupFilters();
    } catch (error) {
        console.error("Error fetching shops:", error);
    }
}

// Expose globally so pagination onclick works
window.initShopsList = initShopsList;

function renderFilteredShops() {
    let filtered = allFetchedShops;
    if (isOpenFilter) {
        filtered = allFetchedShops.filter(shop => shop.is_open);
    }
    renderAllShops(filtered);
}

function setupFilters() {
    const searchInput = document.getElementById('shopSearchInput');
    const openNowFilter = document.getElementById('openNowFilter');
    
    if(!searchInput || !openNowFilter) return;

    // Use oninput to easily override event listeners on re-run
    searchInput.oninput = () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            currentSearch = searchInput.value;
            initShopsList(1); // Reset to page 1 on search
        }, 300);
    };

    openNowFilter.onchange = () => {
        isOpenFilter = openNowFilter.checked;
        renderFilteredShops();
    };
}

function renderPagination(response) {
    const container = document.getElementById('shopsPagination');
    if (!container) return;

    container.innerHTML = '';
    
    // Hide pagination controls if it's not a paginated response or there is only 1 page
    if (!response.count || response.count <= 6) {
        container.classList.add('d-none');
        return;
    }
    
    container.classList.remove('d-none');
    
    const totalPages = Math.ceil(response.count / 6);
    
    let paginationHtml = '';
    
    // Previous Button
    if (currentPage > 1) {
        paginationHtml += `
            <button class="btn btn-outline-mesa rounded-pill btn-sm px-3 py-1 fw-bold" onclick="initShopsList(${currentPage - 1})">
                السابق <i class="bi bi-chevron-left ms-1"></i>
            </button>
        `;
    } else {
        paginationHtml += `
            <button class="btn btn-outline-mesa rounded-pill btn-sm px-3 py-1 fw-bold disabled" style="opacity: 0.5;">
                السابق <i class="bi bi-chevron-left ms-1"></i>
            </button>
        `;
    }
    
    // Page Numbers
    paginationHtml += `
        <span class="fw-bold text-espresso small mx-2">
            صفحة <span class="text-marigold">${currentPage}</span> من ${totalPages}
        </span>
    `;
    
    // Next Button
    if (currentPage < totalPages) {
        paginationHtml += `
            <button class="btn btn-outline-mesa rounded-pill btn-sm px-3 py-1 fw-bold" onclick="initShopsList(${currentPage + 1})">
                التالي <i class="bi bi-chevron-right me-1"></i>
            </button>
        `;
    } else {
        paginationHtml += `
            <button class="btn btn-outline-mesa rounded-pill btn-sm px-3 py-1 fw-bold disabled" style="opacity: 0.5;">
                التالي <i class="bi bi-chevron-right me-1"></i>
            </button>
        `;
    }
    
    container.innerHTML = paginationHtml;
}

function renderAllShops(shops) {
    const container = document.getElementById('allShopsList');
    if (!container) return;

    container.innerHTML = '';
    
    if (shops.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up text-center py-5">
                <div class="empty-state-icon mb-3" style="font-size: 3rem; color: var(--color-mesa);"><i class="bi bi-shop"></i></div>
                <p class="fw-bold text-espresso fs-5">مالقينّاش محلات هنا!</p>
                <p class="small text-mesa">جرب تدور بحاجة تانية أو غير الفلاتر</p>
            </div>`;
        return;
    }

    shops.forEach((shop, i) => {
        // Calculate a realistic rating based on shop id
        const rating = (4.4 + (shop.id % 6) * 0.1).toFixed(1);
        
        // Map category descriptions nicely to Egyptian Arabic
        let category = 'محل في قريتك';
        const desc = (shop.description || '').toLowerCase();
        if (desc.includes('grocery') || desc.includes('بقالة') || desc.includes('سوبر')) {
            category = 'بقالة وسوبرماركت';
        } else if (desc.includes('bakery') || desc.includes('مخبز') || desc.includes('عيش')) {
            category = 'مخبز وحلويات دافية';
        } else if (desc.includes('butcher') || desc.includes('لحم') || desc.includes('جزار')) {
            category = 'جزارة ولحوم بلدي';
        } else if (desc.includes('pharmacy') || desc.includes('صيدلية') || desc.includes('دوا')) {
            category = 'صيدلية وخدمات طبية';
        } else if (desc.includes('vegetable') || desc.includes('خضار') || desc.includes('فاكهة')) {
            category = 'خضار وفاكهة طازة';
        } else if (desc.includes('milk') || desc.includes('لبن') || desc.includes('ألبان')) {
            category = 'منتجات ألبان طازة';
        }

        const shopHtml = `
            <div class="animate-up" style="animation-delay: ${i * 0.08}s;">
                <a href="/html/shops/details.html?id=${shop.id}" class="shop-card-split">
                    <div class="shop-card-split-img">
                        <span class="shop-rating-badge">
                            <i class="bi bi-star-fill text-warning"></i>
                            ${rating}
                        </span>
                        ${shop.image 
                            ? `<img src="${shop.image}" class="w-100 h-100 object-fit-cover">` 
                            : `<div class="d-flex h-100 align-items-center justify-content-center text-white fw-bold fs-2" style="background: linear-gradient(135deg, var(--color-terracotta), var(--color-mesa));">${shop.name.charAt(0)}</div>`
                        }
                    </div>
                    <div class="shop-card-split-body">
                        <div class="shop-card-split-category">${category}</div>
                        <h5 class="shop-card-split-name">${shop.name}</h5>
                        <button class="shop-card-split-btn">
                             خش المحل <i class="bi bi-arrow-left-short fs-5"></i>
                        </button>
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
            
            // Render initial Cart inside Checkout Sidebar Card
            updateCartUI();
        } catch (error) {
            console.error("Error:", error);
            const banner = document.getElementById('shopCoverBanner');
            if(banner) {
                banner.innerHTML = `
                    <div class="shop-cover-banner" style="background-color: var(--color-espresso);">
                        <div class="container py-5 text-center animate-up">
                            <i class="bi bi-exclamation-triangle text-danger fs-1"></i>
                            <h2 class="text-white mt-2">حدث خطأ أثناء تحميل بيانات المحل</h2>
                        </div>
                    </div>`;
            }
        }
    } else {
        const banner = document.getElementById('shopCoverBanner');
        if(banner) {
            banner.innerHTML = `
                <div class="shop-cover-banner" style="background-color: var(--color-espresso);">
                    <div class="container py-5 text-center animate-up">
                        <i class="bi bi-question-circle text-mesa fs-1"></i>
                        <h2 class="text-white mt-2">المحل ده مش معروف في قريتنا!</h2>
                    </div>
                </div>`;
        }
    }
}

function renderShopHeader(shop) {
    const bannerContainer = document.getElementById('shopCoverBanner');
    if (!bannerContainer) return;
    
    // Choose high quality background cover photo based on shop name/description
    let coverPhoto = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200';
    const desc = (shop.description || '').toLowerCase();
    const name = shop.name.toLowerCase();
    
    if (desc.includes('grocery') || name.includes('سوبر') || name.includes('بقالة') || name.includes('ماركت')) {
        coverPhoto = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200'; // groceries
    } else if (desc.includes('bakery') || name.includes('مخبز') || name.includes('حلواني') || name.includes('فرن')) {
        coverPhoto = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1200'; // bakery
    } else if (desc.includes('butcher') || name.includes('لحم') || name.includes('جزار') || name.includes('لحوم')) {
        coverPhoto = 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?q=80&w=1200'; // meat
    } else if (desc.includes('pharmacy') || name.includes('صيدلية') || name.includes('دوا')) {
        coverPhoto = 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?q=80&w=1200'; // pharmacy
    } else if (desc.includes('vegetable') || name.includes('خضار') || name.includes('فاكهة') || name.includes('سوق')) {
        coverPhoto = 'https://images.unsplash.com/photo-1574316071802-0d684efa7bf5?q=80&w=1200'; // greens
    } else if (shop.image) {
        coverPhoto = shop.image;
    }

    const rating = (4.4 + (shop.id % 6) * 0.1).toFixed(1);
    const deliveryTime = (15 + (shop.id % 4) * 5) + '-' + (25 + (shop.id % 4) * 5) + ' دقيقة';
    
    let category = 'محل في قريتك';
    if (desc.includes('grocery') || desc.includes('بقالة') || desc.includes('سوبر')) {
        category = 'بقالة وسوبرماركت';
    } else if (desc.includes('bakery') || desc.includes('مخبز') || desc.includes('عيش')) {
        category = 'مخبز وحلويات دافية';
    } else if (desc.includes('butcher') || desc.includes('لحم') || desc.includes('جزار')) {
        category = 'جزارة ولحوم بلدي';
    } else if (desc.includes('pharmacy') || desc.includes('صيدلية') || desc.includes('دوا')) {
        category = 'صيدلية وخدمات طبية';
    } else if (desc.includes('vegetable') || desc.includes('خضار') || desc.includes('فاكهة')) {
        category = 'خضار وفاكهة طازة';
    }

    bannerContainer.innerHTML = `
        <div class="shop-cover-banner" style="background-image: linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.75)), url('${coverPhoto}');">
            <div class="container pb-4 w-100 animate-up">
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb m-0 mb-3">
                        <li class="breadcrumb-item"><a href="/html/shops/list.html" class="text-white-50 text-decoration-none fw-bold"><i class="bi bi-arrow-right-short"></i> الرجوع للمحلات</a></li>
                    </ol>
                </nav>
                <h1 class="shop-cover-title text-white fw-bold mb-3">${shop.name}</h1>
                <div class="shop-cover-badges">
                    <span class="shop-cover-badge-item">
                        <i class="bi bi-star-fill"></i>
                        <span>${rating} (120+ تقييم)</span>
                    </span>
                    <span class="shop-cover-badge-item">
                        <i class="bi bi-clock-fill"></i>
                        <span>${deliveryTime} دليفري</span>
                    </span>
                    <span class="shop-cover-badge-item">
                        <i class="bi bi-tag-fill"></i>
                        <span>${category}</span>
                    </span>
                    <span class="shop-cover-badge-item">
                        <i class="bi ${shop.is_open ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}"></i>
                        <span class="${shop.is_open ? 'text-success' : 'text-danger'}">${shop.is_open ? 'مفتوح دلوقتي' : 'مقفول دلوقتي'}</span>
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
            <div class="col-12 text-center text-mesa py-5 animate-up">
                <i class="bi bi-box-seam fs-1 text-mesa-light mb-3 d-block" style="opacity: 0.5;"></i>
                <p class="fw-bold mb-0 fs-5">المحل لسه ماضافش منتجات!</p>
                <p class="small text-muted">تابعنا قريب، هننزل كل المنتجات المتاحة هنا</p>
            </div>`;
        return;
    }

    products.forEach((product, i) => {
        const html = `
            <div class="col-lg-4 col-md-6 animate-up" style="animation-delay: ${i * 0.05}s;">
                <div class="product-card h-100">
                    ${product.image 
                        ? `<img src="${product.image}" class="product-img">` 
                        : `<div class="product-img-placeholder"><i class="bi bi-image"></i></div>`
                    }
                    <div class="card-body p-3 d-flex flex-column justify-content-between flex-grow-1">
                        <div>
                            <p class="product-name mb-1">${product.name}</p>
                            <p class="text-mesa small mb-3" style="min-height: 2rem; font-size: 0.85rem;">${product.description || 'من منتجات بركة الطازة والجميلة.'}</p>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-auto">
                            <span class="product-price">${product.price} ج.م</span>
                            ${product.available 
                                ? `<button onclick="addToCart(${product.id}, '${product.name}', ${product.price}, '${product.image || ''}')" class="btn-add-circle" title="أضف للسلة">
                                       <i class="bi bi-plus-lg"></i>
                                   </button>`
                                : `<span class="badge bg-danger rounded-pill small">خلصان</span>`
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

window.addToCart = function(id, name, price, image = '') {
    const token = localStorage.getItem('access_token');
    if (!token) {
        if(window.showBarakaToast) {
            window.showBarakaToast('يرجى تسجيل الدخول أولاً لتتمكن من الطلب.', 'error', 'bi-exclamation-circle');
        } else {
            alert('يرجى تسجيل الدخول أولاً لتتمكن من الطلب.');
        }
        setTimeout(() => window.location.href = '/html/auth/login.html', 1500);
        return;
    }
    
    const role = localStorage.getItem('user_role');
    if (role && role !== 'CUSTOMER') {
        if(window.showBarakaToast) {
            window.showBarakaToast('عذراً، الحسابات التجارية لا يمكنها الشراء.', 'warning', 'bi-exclamation-triangle');
        } else {
            alert('عذراً، الحسابات التجارية (أصحاب المحلات والطيارين) لا يمكنها تقديم طلبات شراء من المتجر. يرجى استخدام حساب مشتري.');
        }
        return;
    }
    
    const existing = cart.find(it => it.product === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ product: id, name: name, price: price, quantity: 1, image: image });
    }
    updateCartUI();
    
    // Visual indicator of item added using Premium Toast
    if(window.showBarakaToast) {
        window.showBarakaToast(`تم إضافة "${name}" للسلة بنجاح!`, 'success', 'bi-cart-check');
    }
    
    // Also keep the button visual cue for immediate feedback
    const btn = document.querySelector(`[onclick*="addToCart(${id}"]`);
    if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="bi bi-check-lg"></i>`;
        btn.style.backgroundColor = '#198754';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#198754';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.backgroundColor = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 1200);
    }
}

function updateCartUI() {
    // 1. Sync global cart items to window for navbar badge sync
    window.cart = cart;
    if (window.updateHeaderCartUI) {
        window.updateHeaderCartUI();
    }

    // 2. Update global floating cart button (mobile)
    const floatingBtn = document.getElementById('floatingCartBtn');
    const badge = document.getElementById('cartCountBadge');
    
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (floatingBtn && badge) {
        if (totalQty > 0) {
            floatingBtn.classList.remove('d-none');
            badge.innerText = totalQty;
        } else {
            floatingBtn.classList.add('d-none');
        }
    }

    // 3. Render modern Checkout Sidebar Card
    const sidebar = document.getElementById('checkoutSidebar');
    if (!sidebar) return;
    
    if (cart.length === 0) {
        sidebar.innerHTML = `
            <div class="checkout-sidebar-title border-0 mb-0">
                <i class="bi bi-cart3 text-marigold"></i> سلة طلباتك
            </div>
            <div class="text-center py-5 text-mesa">
                <i class="bi bi-cart-x fs-1 text-mesa-light mb-3 d-block" style="opacity: 0.35;"></i>
                <p class="fw-bold mb-1 fs-6">سلتك فاضية دلوقتي</p>
                <p class="small mb-0 text-muted">ضيف حتة طماطم أو لبن طازة وابدأ طلبك!</p>
            </div>
        `;
        return;
    }
    
    let itemsHtml = '';
    let subtotal = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        itemsHtml += `
            <div class="checkout-sidebar-item">
                <div class="checkout-sidebar-item-info">
                    <span class="checkout-sidebar-item-qty">${item.quantity}</span>
                    <span class="checkout-sidebar-item-name">${item.name}</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="checkout-sidebar-item-price">${itemTotal.toFixed(2)} ج.م</span>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-light p-0 border rounded d-flex align-items-center justify-content-center" style="width:20px;height:20px;font-size:0.75rem;font-weight:bold;" onclick="changeQuantity(${item.product}, -1)">-</button>
                        <button class="btn btn-sm btn-light p-0 border rounded d-flex align-items-center justify-content-center" style="width:20px;height:20px;font-size:0.75rem;font-weight:bold;" onclick="changeQuantity(${item.product}, 1)">+</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    const deliveryFee = 15; // EGP village delivery
    const total = subtotal + deliveryFee;
    
    sidebar.innerHTML = `
        <div class="checkout-sidebar-title">
            <i class="bi bi-cart3 text-marigold"></i> طلباتك الفريش (${cart.length})
        </div>
        <div class="checkout-sidebar-items-list">
            ${itemsHtml}
        </div>
        <div class="checkout-sidebar-summary">
            <div class="checkout-sidebar-summary-row">
                <span>الإجمالي الفرعي</span>
                <span>${subtotal.toFixed(2)} ج.م</span>
            </div>
            <div class="checkout-sidebar-summary-row">
                <span>خدمة التوصيل (دليفري)</span>
                <span>${deliveryFee.toFixed(2)} ج.م</span>
            </div>
            <div class="checkout-sidebar-summary-total">
                <span>المجموع الكلي</span>
                <span class="text-marigold">${total.toFixed(2)} ج.م</span>
            </div>
        </div>
        <div class="mb-3">
            <label class="form-label text-espresso fw-bold small mb-1"><i class="bi bi-geo-alt-fill text-marigold me-1"></i>عنوان التوصيل في القرية</label>
            <input type="text" class="form-control rounded-pill px-3 py-2" id="orderAddress" style="font-size:0.85rem;" placeholder="مثال: بحري البلد، جنب الجامع الكبير...">
        </div>
        <button onclick="submitOrder()" class="btn btn-marigold checkout-sidebar-btn text-white fw-bold" id="submitOrderBtn">
            <i class="bi bi-check-all me-1"></i>تأكيد الطلب ودليفري!
        </button>
    `;
    
    // Auto-populate address from profile if logged in
    const token = localStorage.getItem('access_token');
    if (token) {
        api.auth.getProfile(token).then(profile => {
            const addressInput = document.getElementById('orderAddress');
            if (profile.location && addressInput && !addressInput.value.trim()) {
                addressInput.value = profile.location;
            }
        }).catch(err => console.error("Error autofilling address:", err));
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
            <div class="d-flex align-items-center mb-3 pb-3 border-bottom" style="border-color: rgba(201,153,151,0.15) !important;">
                <div class="me-3" style="width: 55px; height: 55px; border-radius: 12px; overflow: hidden; flex-shrink: 0; background: var(--color-dune);">
                    ${item.image 
                        ? `<img src="${item.image}" class="w-100 h-100 object-fit-cover">` 
                        : `<div class="d-flex h-100 align-items-center justify-content-center text-marigold"><i class="bi bi-box-seam"></i></div>`
                    }
                </div>
                <div class="flex-grow-1">
                    <h6 class="fw-bold text-espresso mb-1" style="font-size: 0.95rem;">${item.name}</h6>
                    <small class="text-marigold fw-bold">${item.price} ج.م</small>
                </div>
                <div class="d-flex align-items-center gap-1 bg-white border rounded-pill px-2 py-1" style="border-color: rgba(201,153,151,0.2) !important;">
                    <button class="btn btn-sm btn-link text-mesa p-0 text-decoration-none fw-bold" style="width: 24px; height: 24px;" onclick="changeQuantity(${item.product}, -1)">-</button>
                    <span class="fw-bold text-espresso px-2" style="font-size: 0.9rem;">${item.quantity}</span>
                    <button class="btn btn-sm btn-link text-mesa p-0 text-decoration-none fw-bold" style="width: 24px; height: 24px;" onclick="changeQuantity(${item.product}, 1)">+</button>
                </div>
                <button class="btn btn-sm btn-link text-danger ms-2 p-1" onclick="removeFromCart(${item.product})" title="حذف">
                    <i class="bi bi-trash3"></i>
                </button>
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
            
            // Re-render modal contents only if the modal is open
            const modalEl = document.getElementById('cartModal');
            if (modalEl && modalEl.classList.contains('show')) {
                openCartModal();
            }
        }
    }
}

window.removeFromCart = function(productId) {
    cart = cart.filter(it => it.product !== productId);
    updateCartUI();
    
    const modalEl = document.getElementById('cartModal');
    if (cart.length === 0 && modalEl && modalEl.classList.contains('show')) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
}

window.submitOrder = async function() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    const addressInput = document.getElementById('orderAddress');
    const address = addressInput ? addressInput.value.trim() : '';
    if (!address) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى تحديد عنوان التوصيل أولاً.', 'error', 'bi-geo-alt');
        } else {
            alert('يرجى تحديد عنوان التوصيل أولاً.');
        }
        return;
    }
    
    const params = new URLSearchParams(window.location.search);
    const shopId = params.get('id');
    
    const submitBtn = document.getElementById('submitOrderBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'جاري إرسال الطلب...';
    }
    
    const orderData = {
        shop: parseInt(shopId),
        address: address,
        items: cart.map(it => ({ product: it.product, quantity: it.quantity }))
    };
    
    try {
        await api.orders.create(token, orderData);
        if (window.showBarakaToast) {
            window.showBarakaToast('تم إرسال طلبك بنجاح! سيصلك الدليفري فوراً.', 'success', 'bi-check-all');
        } else {
            alert('تم إرسال طلبك بنجاح! سيقوم المحل بمراجعته فوراً.');
        }
        
        cart = [];
        updateCartUI();
        
        const modalEl = document.getElementById('cartModal');
        if (modalEl && modalEl.classList.contains('show')) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
    } catch (error) {
        if (window.showBarakaToast) {
            window.showBarakaToast('حدث خطأ أثناء إرسال الطلب.', 'error', 'bi-exclamation-triangle');
        } else {
            alert('حدث خطأ أثناء إرسال الطلب: ' + JSON.stringify(error));
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'تأكيد الطلب ودليفري!';
        }
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
        countBadge.innerText = `موجود ${pinnedShops.length} محلات على الخريطة`;
    }

    if (pinnedShops.length === 0) {
        mapContainer.innerHTML = `
            <div class="d-flex align-items-center justify-content-center h-100 bg-light text-muted">
                <div class="text-center py-5">
                    <i class="bi bi-geo-alt-fill fs-1 text-mesa mb-2 animate-up"></i>
                    <p class="mb-0 fw-bold">مافيش محلات على الخريطة دلوقتي</p>
                    <p class="small text-mesa mt-1">تصفح المحلات المتاحة في القائمة الجانبية</p>
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
                            ${shop.is_open ? 'مفتوح دلوقتي' : 'مقفول دلوقتي'}
                        </span>
                    </div>
                </div>
                <p class="text-mesa small mb-2" style="max-height: 3rem; overflow: hidden; font-size: 0.8rem;">${shop.description || 'محل مميز في قرية بركة.'}</p>
                <div class="text-muted small mb-3" style="font-size: 0.8rem;"><i class="bi bi-geo-alt-fill text-marigold me-1"></i>${shop.address || 'عنوان في القرية'}</div>
                <a href="/html/shops/details.html?id=${shop.id}" class="btn btn-marigold btn-sm rounded-pill w-100 py-2 fw-bold text-white shadow-sm text-decoration-none">
                    خش المحل <i class="bi bi-arrow-left-short ms-1"></i>
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
