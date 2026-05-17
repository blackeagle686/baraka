document.addEventListener('DOMContentLoaded', () => {
    fetchShopsPreview();
});

async function fetchShopsPreview() {
    try {
        const response = await api.shops.getAll(1);
        const shops = response.results || response;
        renderShops(shops);
    } catch (error) {
        console.error("Error fetching shops:", error);
    }
}

function renderShops(shops) {
    const container = document.getElementById('shopsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (shops.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up">
                <div class="empty-state-icon"><i class="bi bi-shop"></i></div>
                <p class="fw-bold">لا توجد محلات حالياً</p>
                <p class="small text-mesa">كن أول من يفتح محله على منصة بركة!</p>
            </div>`;
        return;
    }

    // Show up to 4 shops on landing page
    shops.slice(0, 4).forEach((shop, i) => {
        const shopHtml = `
            <div class="col-md-3 col-sm-6 animate-up delay-${i + 1}">
                <a href="/html/shops/details.html?id=${shop.id}" class="text-decoration-none">
                    <div class="shop-card-home h-100">
                        <div class="shop-img-placeholder">
                            ${shop.image ? `<img src="${shop.image}" class="w-100 h-100 object-fit-cover">` : `<span>${shop.name.charAt(0)}</span>`}
                        </div>
                        <div class="card-body text-center p-3">
                            <h6 class="fw-bold text-espresso mb-1">${shop.name}</h6>
                            <p class="text-mesa small mb-2">${shop.description ? shop.description.substring(0, 50) : 'أفضل المنتجات وأسرع توصيل'}</p>
                            <span class="btn btn-outline-primary btn-sm rounded-pill w-100">
                                <i class="bi bi-arrow-left me-1"></i>تسوق الآن
                            </span>
                        </div>
                    </div>
                </a>
            </div>
        `;
        container.innerHTML += shopHtml;
    });
}

function initCounters() {
    const counters = document.querySelectorAll('.counter');
    const speed = 100; // lower is faster

    const startCounting = (counter) => {
        const updateCount = () => {
            const target = +counter.getAttribute('data-target');
            const count = +counter.innerText;
            const inc = target / speed;

            if (count < target) {
                counter.innerText = Math.ceil(count + inc);
                setTimeout(updateCount, 20);
            } else {
                counter.innerText = target;
            }
        };
        updateCount();
    };

    // Use Intersection Observer for counters
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                startCounting(entry.target);
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => observer.observe(counter));
}

// Add to DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initCounters();
});
