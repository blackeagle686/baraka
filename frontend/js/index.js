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
    const giantText = document.querySelector('.hero-giant-text');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    let width, height;
    let particles = [];
    
    // Mouse tracking
    let mouse = { x: null, y: null, radius: 180 };
    
    // Resize canvas
    const resize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = document.querySelector('.hero-section').offsetHeight || window.innerHeight;
        initParticles();
    };
    
    window.addEventListener('resize', resize);
    
    // Mouse event listeners for particles and parallax
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        heroSection.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
            
            // Parallax effect on giant text
            if (giantText) {
                const centerX = width / 2;
                const centerY = height / 2;
                const moveX = (mouse.x - centerX) * 0.03;
                const moveY = (mouse.y - centerY) * 0.03;
                giantText.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px)) scale(1.02)`;
            }
        });
        
        heroSection.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
            if (giantText) {
                giantText.style.transform = `translate(-50%, -50%) scale(1)`;
            }
        });
    }
    
    // Particle Class
    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2.5 + 0.5;
            this.baseX = this.x;
            this.baseY = this.y;
            this.density = (Math.random() * 30) + 5;
            this.color = `rgba(194, 146, 64, ${Math.random() * 0.6 + 0.2})`;
            // Give some particles a glowing effect
            this.isGlowing = Math.random() > 0.8;
        }
        
        draw() {
            if (this.isGlowing) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(194, 146, 64, 0.8)';
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0; // reset
        }
        
        update() {
            // Very slow drifting even without mouse
            this.baseX += (Math.random() - 0.5) * 0.2;
            this.baseY += (Math.random() - 0.5) * 0.2;
            
            // Wrap around edges for base positions
            if (this.baseX > width + 50) this.baseX = -50;
            if (this.baseX < -50) this.baseX = width + 50;
            if (this.baseY > height + 50) this.baseY = -50;
            if (this.baseY < -50) this.baseY = height + 50;

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
                    this.x -= dx / 15; // smooth return
                }
                if (this.y !== this.baseY) {
                    let dy = this.y - this.baseY;
                    this.y -= dy / 15;
                }
            }
        }
    }
    
    function initParticles() {
        particles = [];
        let numParticles = Math.min((width * height) / 9000, 200); // Optimized count
        for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle());
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
            
            for (let j = i + 1; j < particles.length; j++) {
                let dx = particles[i].x - particles[j].x;
                let dy = particles[i].y - particles[j].y;
                let distance = dx * dx + dy * dy;
                
                if (distance < 15000) { // Connect distance squared
                    ctx.beginPath();
                    let opacity = 0.38 - (distance / 15000) * 0.38;
                    ctx.strokeStyle = `rgba(194, 146, 64, ${opacity})`;
                    ctx.lineWidth = 1.2;
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
