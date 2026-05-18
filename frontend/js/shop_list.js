/**
 * Shops Directory List UI Scripts (shop_list.js)
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Search Clear Button Visibility ---
    const searchInput = document.getElementById('shopSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');

    if (searchInput && clearBtn) {
        // Show/hide clear button on input
        searchInput.addEventListener('input', () => {
            clearBtn.style.display = searchInput.value.length > 0 ? 'block' : 'none';
        });

        // Click to clear input and trigger refetch
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            searchInput.dispatchEvent(new Event('input'));
            searchInput.focus();
        });
    }

    // --- Category Pill Filter Handler ---
    window.filterByCategory = function(btn, category) {
        // Update active highlight classes
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');

        if (searchInput) {
            if (category) {
                searchInput.value = category;
                searchInput.dispatchEvent(new Event('input'));
                if (clearBtn) clearBtn.style.display = 'block';
            } else {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                if (clearBtn) clearBtn.style.display = 'none';
            }
        }
    };

    // --- Universal Map View Toggle Handler ---
    const mobileViewToggle = document.getElementById('mobileViewToggle');
    const sidebar = document.querySelector('.shops-sidebar');
    const mapWrapper = document.querySelector('.shops-map-wrapper');

    if (mobileViewToggle && sidebar && mapWrapper) {
        
        // Initialize Toggler Button text/color based on viewport on load
        function initToggleState() {
            const isDesktop = window.innerWidth >= 992;
            if (isDesktop) {
                const isMapHidden = mapWrapper.style.display === 'none';
                if (isMapHidden) {
                    mobileViewToggle.innerHTML = '<i class="bi bi-map me-1"></i> عرض الخريطة 🗺️';
                    mobileViewToggle.classList.remove('btn-dark');
                    mobileViewToggle.classList.add('btn-primary');
                } else {
                    mobileViewToggle.innerHTML = '<i class="bi bi-eye-slash me-1"></i> إخفاء الخريطة 🗺️';
                    mobileViewToggle.classList.remove('btn-primary');
                    mobileViewToggle.classList.add('btn-dark');
                }
            } else {
                const isMapHidden = window.getComputedStyle(mapWrapper).display === 'none';
                if (isMapHidden) {
                    mobileViewToggle.innerHTML = '<i class="bi bi-map me-1"></i> عرض الخريطة 🗺️';
                    mobileViewToggle.classList.remove('btn-dark');
                    mobileViewToggle.classList.add('btn-primary');
                } else {
                    mobileViewToggle.innerHTML = '<i class="bi bi-list-ul me-1"></i> عرض القائمة 📋';
                    mobileViewToggle.classList.remove('btn-primary');
                    mobileViewToggle.classList.add('btn-dark');
                }
            }
        }

        // Run on load
        initToggleState();

        // Click Event Handler
        mobileViewToggle.addEventListener('click', () => {
            const isDesktop = window.innerWidth >= 992;
            
            if (isDesktop) {
                // DESKTOP: Toggle between side-by-side split and full-width list
                const isMapHidden = mapWrapper.style.display === 'none';
                
                if (isMapHidden) {
                    // Show Map (Restore Split: 58% Sidebar / 42% Map)
                    sidebar.style.setProperty('width', '58%', 'important');
                    mapWrapper.style.setProperty('display', 'block', 'important');
                    
                    mobileViewToggle.innerHTML = '<i class="bi bi-eye-slash me-1"></i> إخفاء الخريطة 🗺️';
                    mobileViewToggle.classList.remove('btn-primary');
                    mobileViewToggle.classList.add('btn-dark');
                    
                    if (window.directoryMapInstance) {
                        setTimeout(() => {
                            window.directoryMapInstance.invalidateSize();
                        }, 150);
                    }
                } else {
                    // Hide Map (Expand Sidebar to 100% full screen)
                    sidebar.style.setProperty('width', '100%', 'important');
                    mapWrapper.style.setProperty('display', 'none', 'important');
                    
                    mobileViewToggle.innerHTML = '<i class="bi bi-map me-1"></i> عرض الخريطة 🗺️';
                    mobileViewToggle.classList.remove('btn-dark');
                    mobileViewToggle.classList.add('btn-primary');
                }
            } else {
                // MOBILE: Toggle between showing Map only or List only
                const isMapHidden = window.getComputedStyle(mapWrapper).display === 'none';
                
                if (isMapHidden) {
                    // Show Map, Hide Sidebar List
                    sidebar.style.setProperty('display', 'none', 'important');
                    mapWrapper.style.setProperty('display', 'block', 'important');
                    
                    mobileViewToggle.innerHTML = '<i class="bi bi-list-ul me-1"></i> عرض القائمة 📋';
                    mobileViewToggle.classList.remove('btn-primary');
                    mobileViewToggle.classList.add('btn-dark');
                    
                    if (window.directoryMapInstance) {
                        setTimeout(() => {
                            window.directoryMapInstance.invalidateSize();
                        }, 150);
                    }
                } else {
                    // Show Sidebar List, Hide Map
                    sidebar.style.setProperty('display', 'flex', 'important');
                    mapWrapper.style.setProperty('display', 'none', 'important');
                    
                    mobileViewToggle.innerHTML = '<i class="bi bi-map me-1"></i> عرض الخريطة 🗺️';
                    mobileViewToggle.classList.remove('btn-dark');
                    mobileViewToggle.classList.add('btn-primary');
                }
            }
        });

        // Window Resize Cleanup Safeguard
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                sidebar.style.removeProperty('width');
                sidebar.style.removeProperty('display');
                mapWrapper.style.removeProperty('display');
                initToggleState();
            }, 200);
        });
    }
});
