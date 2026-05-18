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

    // --- Mobile Map View Toggle Handler ---
    const mobileViewToggle = document.getElementById('mobileViewToggle');
    const sidebar = document.querySelector('.shops-sidebar');
    const mapWrapper = document.querySelector('.shops-map-wrapper');

    if (mobileViewToggle && sidebar && mapWrapper) {
        mobileViewToggle.addEventListener('click', () => {
            // Check computed visibility state of map wrapper on mobile
            const isMapHidden = window.getComputedStyle(mapWrapper).display === 'none';

            if (isMapHidden) {
                // Show Map, Hide Sidebar List
                sidebar.style.setProperty('display', 'none', 'important');
                mapWrapper.style.setProperty('display', 'block', 'important');
                
                // Update toggle button text and styling
                mobileViewToggle.innerHTML = '<i class="bi bi-list-ul me-1"></i> عرض القائمة 📋';
                mobileViewToggle.classList.remove('btn-primary');
                mobileViewToggle.classList.add('btn-dark');

                // Recalculate Leaflet map container viewport bounds to fit pins perfectly
                if (window.directoryMapInstance) {
                    setTimeout(() => {
                        window.directoryMapInstance.invalidateSize();
                    }, 150);
                }
            } else {
                // Show Sidebar List, Hide Map
                sidebar.style.setProperty('display', 'flex', 'important');
                mapWrapper.style.setProperty('display', 'none', 'important');
                
                // Update toggle button text and styling
                mobileViewToggle.innerHTML = '<i class="bi bi-map me-1"></i> عرض الخريطة 🗺️';
                mobileViewToggle.classList.remove('btn-dark');
                mobileViewToggle.classList.add('btn-primary');
            }
        });
    }
});
