document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('clinicSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');

    if (searchInput && clearBtn) {
        searchInput.addEventListener('input', () => {
            clearBtn.style.display = searchInput.value.length > 0 ? 'block' : 'none';
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            searchInput.dispatchEvent(new Event('input'));
            searchInput.focus();
        });
    }

    window.filterBySpecialization = function(btn, specialization) {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');

        if (searchInput) {
            if (specialization) {
                searchInput.value = specialization;
                searchInput.dispatchEvent(new Event('input'));
                if (clearBtn) clearBtn.style.display = 'block';
            } else {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                if (clearBtn) clearBtn.style.display = 'none';
            }
        }
    };

    const mobileViewToggle = document.getElementById('mobileViewToggle');
    const sidebar = document.querySelector('.shops-sidebar');
    const mapWrapper = document.querySelector('.shops-map-wrapper');

    if (mobileViewToggle && sidebar && mapWrapper) {
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

        initToggleState();

        mobileViewToggle.addEventListener('click', () => {
            const isDesktop = window.innerWidth >= 992;

            if (isDesktop) {
                const isMapHidden = mapWrapper.style.display === 'none';
                if (isMapHidden) {
                    sidebar.style.setProperty('width', '58%', 'important');
                    mapWrapper.style.setProperty('display', 'block', 'important');
                    mobileViewToggle.innerHTML = '<i class="bi bi-eye-slash me-1"></i> إخفاء الخريطة 🗺️';
                    mobileViewToggle.classList.remove('btn-primary');
                    mobileViewToggle.classList.add('btn-dark');
                    if (window.directoryMapInstance) {
                        setTimeout(() => {
                            window.directoryMapInstance.invalidateSize();
                            if (window.directoryMapBounds && window.directoryMapBounds.length > 0) {
                                window.directoryMapInstance.fitBounds(window.directoryMapBounds, { padding: [50, 50], maxZoom: 15 });
                            }
                        }, 150);
                    }
                } else {
                    sidebar.style.setProperty('width', '100%', 'important');
                    mapWrapper.style.setProperty('display', 'none', 'important');
                    mobileViewToggle.innerHTML = '<i class="bi bi-map me-1"></i> عرض الخريطة 🗺️';
                    mobileViewToggle.classList.remove('btn-dark');
                    mobileViewToggle.classList.add('btn-primary');
                }
            } else {
                const isMapHidden = window.getComputedStyle(mapWrapper).display === 'none';
                if (isMapHidden) {
                    sidebar.style.setProperty('display', 'none', 'important');
                    mapWrapper.style.setProperty('display', 'block', 'important');
                    mobileViewToggle.innerHTML = '<i class="bi bi-list-ul me-1"></i> عرض القائمة 📋';
                    mobileViewToggle.classList.remove('btn-primary');
                    mobileViewToggle.classList.add('btn-dark');
                    if (window.directoryMapInstance) {
                        setTimeout(() => {
                            window.directoryMapInstance.invalidateSize();
                            if (window.directoryMapBounds && window.directoryMapBounds.length > 0) {
                                window.directoryMapInstance.fitBounds(window.directoryMapBounds, { padding: [50, 50], maxZoom: 15 });
                            }
                        }, 150);
                    }
                } else {
                    sidebar.style.setProperty('display', 'flex', 'important');
                    mapWrapper.style.setProperty('display', 'none', 'important');
                    mobileViewToggle.innerHTML = '<i class="bi bi-map me-1"></i> عرض الخريطة 🗺️';
                    mobileViewToggle.classList.remove('btn-dark');
                    mobileViewToggle.classList.add('btn-primary');
                }
            }
        });

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
