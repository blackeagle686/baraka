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
            <div class="col-md-3 col-sm-6 text-center animate-up delay-${i + 1}">
                <a href="/html/shops/details.html?id=${shop.id}" class="shop-circle-link text-decoration-none d-inline-block">
                    <div class="shop-circle-item mb-3 mx-auto">
                        ${shop.image 
                            ? `<img src="${shop.image}" class="w-100 h-100 object-fit-cover rounded-circle">` 
                            : `<div class="shop-circle-placeholder rounded-circle d-flex align-items-center justify-content-center text-white fw-bold fs-2" style="background: linear-gradient(135deg, var(--color-terracotta), var(--color-mesa));">${shop.name.charAt(0)}</div>`
                        }
                        <div class="shop-circle-overlay rounded-circle">
                            <i class="bi bi-arrow-left-short fs-2 text-white"></i>
                        </div>
                    </div>
                    <h6 class="fw-bold text-espresso shop-circle-name mb-0">${shop.name}</h6>
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
    initHeroInteractivity();
});

function initHeroInteractivity() {
    const searchForm = document.getElementById('heroSearchForm');
    const searchInput = document.getElementById('heroSearchInput');
    
    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/html/shops/list.html?search=${encodeURIComponent(query)}`;
            }
        });
    }

    // Bind Quick Category tags
    const categoryTags = document.querySelectorAll('.btn-category-tag');
    categoryTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const category = tag.getAttribute('data-category');
            if (category) {
                window.location.href = `/html/shops/list.html?search=${encodeURIComponent(category)}`;
            }
        });
    });
}
