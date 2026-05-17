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
                            <span class="badge ${product.available ? 'bg-success' : 'bg-danger'} rounded-pill small">
                                ${product.available ? 'متوفر' : 'غير متوفر'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}
