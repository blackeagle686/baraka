let mobileRestListViewActive = true;

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('restListToggleView');
    const sidebarPanel = document.getElementById('restSidebarPanel');
    const mapWrapper = document.getElementById('restMapWrapper');

    if (toggleBtn && sidebarPanel && mapWrapper) {
        toggleBtn.addEventListener('click', () => {
            mobileRestListViewActive = !mobileRestListViewActive;
            if (mobileRestListViewActive) {
                sidebarPanel.style.display = 'block';
                mapWrapper.style.display = 'none';
                toggleBtn.innerHTML = '<i class="bi bi-map fs-5"></i>';
            } else {
                sidebarPanel.style.display = 'none';
                mapWrapper.style.display = 'block';
                toggleBtn.innerHTML = '<i class="bi bi-list fs-5"></i>';
                if (window.restMapInstance) setTimeout(() => window.restMapInstance.invalidateSize(), 200);
            }
        });
    }

    const searchInput = document.getElementById('restSearchInput');
    const clearBtn = document.getElementById('restSearchClear');
    if (searchInput && clearBtn) {
        searchInput.addEventListener('input', () => {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        });
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            searchInput.dispatchEvent(new Event('input'));
            if (window.loadRestaurantsList) window.loadRestaurantsList();
        });
    }

    document.querySelectorAll('.rest-category-pill').forEach(pill => {
        pill.addEventListener('click', function () {
            document.querySelectorAll('.rest-category-pill').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            if (searchInput) {
                searchInput.value = this.dataset.search || '';
                clearBtn.style.display = searchInput.value ? 'block' : 'none';
            }
            if (window.loadRestaurantsList) window.loadRestaurantsList();
        });
    });
});
