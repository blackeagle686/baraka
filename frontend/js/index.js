document.addEventListener('DOMContentLoaded', () => {
    fetchShopsPreview();
});

async function fetchShopsPreview() {
    try {
        const shops = await api.shops.getAll();
        renderShops(shops);
    } catch (error) {
        console.error("Error fetching shops:", error);
    }
}

function renderShops(shops) {
    const container = document.getElementById('shopsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Only show up to 3 shops on the landing page
    shops.slice(0, 3).forEach(shop => {
        const shopHtml = `
            <div class="col-md-4 mb-4">
                <div class="card shop-card border-0 h-100">
                    <div class="card-img-top shop-img-placeholder d-flex align-items-center justify-content-center">
                        ${shop.image ? `<img src="${shop.image}" class="w-100 h-100 object-fit-cover">` : `<span class="text-white fs-1 fw-bold">${shop.name.charAt(0)}</span>`}
                    </div>
                    <div class="card-body text-center">
                        <h5 class="card-title fw-bold text-espresso">${shop.name}</h5>
                        <p class="card-text text-mesa">${shop.description || 'أفضل المنتجات وأسرع توصيل'}</p>
                        <a href="html/shops/details.html?id=${shop.id}" class="btn btn-outline-primary rounded-pill w-100 mt-2">تسوق الآن</a>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += shopHtml;
    });

    if (shops.length === 0) {
        container.innerHTML = '<p class="text-center text-mesa">لا توجد محلات حالياً. كن أول من يفتح محله!</p>';
    }
}
