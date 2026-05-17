document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on
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
        container.innerHTML = '<p class="text-center text-mesa w-100">لا توجد محلات حالياً.</p>';
        return;
    }

    shops.forEach(shop => {
        const shopHtml = `
            <div class="col-md-3 mb-4 animate-up">
                <div class="card shop-card border-0 h-100">
                    <div class="card-img-top shop-img-placeholder d-flex align-items-center justify-content-center" style="height: 150px;">
                        ${shop.image ? `<img src="${shop.image}" class="w-100 h-100 object-fit-cover">` : `<span class="text-white fs-2 fw-bold">${shop.name.charAt(0)}</span>`}
                    </div>
                    <div class="card-body text-center">
                        <h5 class="card-title fw-bold text-espresso">${shop.name}</h5>
                        <a href="details.html?id=${shop.id}" class="btn btn-outline-primary rounded-pill w-100 mt-3 btn-sm">عرض المنتجات</a>
                    </div>
                </div>
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
            document.getElementById('shopHeader').innerHTML = '<h2 class="text-danger">حدث خطأ أثناء تحميل المحل</h2>';
        }
    } else {
        document.getElementById('shopHeader').innerHTML = '<h2 class="text-danger">محل غير معروف</h2>';
    }
}

function renderShopHeader(shop) {
    const header = document.getElementById('shopHeader');
    if (!header) return;

    header.innerHTML = `
        <div class="d-flex align-items-center justify-content-center flex-column">
            ${shop.image ? `<img src="${shop.image}" class="rounded-circle mb-3 shadow" style="width:120px;height:120px;object-fit:cover;">` : `<div class="rounded-circle mb-3 d-flex align-items-center justify-content-center bg-terracotta text-white fs-1 shadow" style="width:120px;height:120px;">${shop.name.charAt(0)}</div>`}
            <h2 class="fw-bold text-espresso">${shop.name}</h2>
            <p class="text-mesa mb-1">${shop.description || ''}</p>
            <span class="badge ${shop.is_open ? 'bg-success' : 'bg-danger'} rounded-pill px-3 py-2 mt-2">${shop.is_open ? 'مفتوح الآن' : 'مغلق'}</span>
        </div>
    `;
}

function renderShopProducts(products) {
    const container = document.getElementById('productsList');
    if (!container) return;

    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p class="text-mesa w-100">لا توجد منتجات متوفرة حالياً.</p>';
        return;
    }

    products.forEach(product => {
        const html = `
            <div class="col-md-4 mb-4 animate-up">
                <div class="card shop-card border-0 h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="fw-bold text-espresso">${product.name}</h5>
                            <span class="text-marigold fw-bold">${product.price} ج.م</span>
                        </div>
                        <p class="text-mesa small mb-3">${product.description || ''}</p>
                        <button class="btn btn-primary btn-sm rounded-pill w-100" ${!product.available ? 'disabled' : ''}>
                            ${product.available ? 'أضف للسلة' : 'غير متوفر'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}
