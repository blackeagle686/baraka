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
    initInteractiveNet();
});

function initInteractiveNet() {
    const canvas = document.getElementById('interactive-net');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    let width, height;
    let particles = [];
    
    // Mouse tracking
    let mouse = { x: null, y: null, radius: 150 };
    
    // Resize canvas
    const resize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = document.querySelector('.hero-section').offsetHeight;
        initParticles();
    };
    
    window.addEventListener('resize', resize);
    
    // Mouse event listeners
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });
    
    canvas.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });
    
    // Particle Class
    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2 + 1;
            this.baseX = this.x;
            this.baseY = this.y;
            this.density = (Math.random() * 20) + 5;
            this.color = `rgba(194, 146, 64, ${Math.random() * 0.5 + 0.2})`;
        }
        
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
        }
        
        update() {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            
            let forceDirectionX = dx / distance;
            let forceDirectionY = dy / distance;
            
            const maxDistance = mouse.radius;
            let force = (maxDistance - distance) / maxDistance;
            
            let directionX = forceDirectionX * force * this.density;
            let directionY = forceDirectionY * force * this.density;
            
            if (distance < mouse.radius && mouse.x !== null) {
                this.x -= directionX;
                this.y -= directionY;
            } else {
                if (this.x !== this.baseX) {
                    let dx = this.x - this.baseX;
                    this.x -= dx / 20;
                }
                if (this.y !== this.baseY) {
                    let dy = this.y - this.baseY;
                    this.y -= dy / 20;
                }
            }
        }
    }
    
    function initParticles() {
        particles = [];
        let numParticles = Math.min((width * height) / 12000, 150); // limit max particles for performance
        for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle());
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
            
            for (let j = i; j < particles.length; j++) {
                let dx = particles[i].x - particles[j].x;
                let dy = particles[i].y - particles[j].y;
                let distance = dx * dx + dy * dy;
                
                if (distance < 12000) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(201, 153, 151, ${0.15 - (distance / 12000) * 0.15})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                    ctx.closePath();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    
    resize();
    animate();
}
