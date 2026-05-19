let currentShopId = null;
let newShopImageFile = null;
let newProdImageFile = null;
let newEditProdImageFile = null;
let currentProducts = [];
let allCategories = []; // Dynamic from DB

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token');
    const userRole = localStorage.getItem('user_role');

    if (!token || userRole !== 'SHOP_OWNER') {
        window.location.href = '/html/index.html';
        return;
    }

    initShopProfile();

    // Shop Image preview logic
    const shopImageInput = document.getElementById('shopImage');
    if (shopImageInput) {
        shopImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                
                // 1. Size Validation (2MB limit)
                const max_size = 2 * 1024 * 1024;
                if (file.size > max_size) {
                    alert('حجم صورة المحل كبير جداً! الحد الأقصى هو 2 ميجابايت.');
                    e.target.value = ''; // Reset input field
                    return;
                }

                // 2. Format Extension Validation (.jpg, .jpeg, .png, .pdf)
                const allowed_exts = ['.jpg', '.jpeg', '.png', '.pdf'];
                const filename = file.name.toLowerCase();
                const matched = allowed_exts.some(ext => filename.endsWith(ext));
                if (!matched) {
                    alert('صيغة الملف غير مدعومة! الصيغ المسموح بها: JPG, PNG, PDF.');
                    e.target.value = ''; // Reset input field
                    return;
                }

                newShopImageFile = file;
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('shopImagePreview').innerHTML = `<img src="${e.target.result}" class="w-100 h-100 object-fit-cover">`;
                };
                reader.readAsDataURL(newShopImageFile);
            }
        });
    }

    // Shop Form submission
    const shopForm = document.getElementById('shopForm');
    if (shopForm) {
        shopForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleShopSubmit();
        });
    }

    // Product Image logic
    const prodImageInput = document.getElementById('prodImage');
    if (prodImageInput) {
        prodImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                
                // 1. Size Validation (2MB limit)
                const max_size = 2 * 1024 * 1024;
                if (file.size > max_size) {
                    alert('حجم صورة المنتج كبير جداً! الحد الأقصى هو 2 ميجابايت.');
                    e.target.value = ''; // Reset input field
                    newProdImageFile = null;
                    return;
                }

                // 2. Format Extension Validation (.jpg, .jpeg, .png, .pdf)
                const allowed_exts = ['.jpg', '.jpeg', '.png', '.pdf'];
                const filename = file.name.toLowerCase();
                const matched = allowed_exts.some(ext => filename.endsWith(ext));
                if (!matched) {
                    alert('صيغة الملف غير مدعومة! الصيغ المسموح بها: JPG, PNG, PDF.');
                    e.target.value = ''; // Reset input field
                    newProdImageFile = null;
                    return;
                }

                newProdImageFile = file;
            } else {
                newProdImageFile = null;
            }
        });
    }

    // Product Form submission
    const prodForm = document.getElementById('productForm');
    if (prodForm) {
        prodForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleProductSubmit();
        });
    }

    // Edit Product Image logic
    const editProdImageInput = document.getElementById('editProdImage');
    if (editProdImageInput) {
        editProdImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                newEditProdImageFile = e.target.files[0];
            } else {
                newEditProdImageFile = null;
            }
        });
    }

    // Edit Product Form submission
    const editProdForm = document.getElementById('editProductForm');
    if (editProdForm) {
        editProdForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleProductEditSubmit();
        });
    }

    // Delete Product Button logic
    const deleteProdBtn = document.getElementById('deleteProdBtn');
    if (deleteProdBtn) {
        deleteProdBtn.addEventListener('click', async () => {
            await handleProductDelete();
        });
    }
});

async function initShopProfile() {
    const token = localStorage.getItem('access_token');
    try {
        // Fetch all categories first
        try {
            allCategories = await api.categories.getAll();
            populateCategoryDropdowns();
        } catch (catError) {
            console.error("Error loading categories:", catError);
        }

        const shop = await api.shops.getMyShop(token);
        if (shop) {
            currentShopId = shop.id;
            populateShopForm(shop);
            
            const prodSection = document.getElementById('productsSection');
            if (prodSection) prodSection.style.display = 'block';
            const noShopState = document.getElementById('noShopProductsState');
            if (noShopState) noShopState.style.display = 'none';
            
            // Revenue section show/hide
            const revSection = document.getElementById('shopRevenueSection');
            if (revSection) revSection.style.display = 'block';
            const noRevState = document.getElementById('noShopRevenueState');
            if (noRevState) noRevState.style.display = 'none';
            
            loadShopProducts(shop.id);
            loadShopOrders();
        } else {
            document.getElementById('shopTitle').innerText = 'إنشاء محل جديد';
            
            const prodSection = document.getElementById('productsSection');
            if (prodSection) prodSection.style.display = 'none';
            const noShopState = document.getElementById('noShopProductsState');
            if (noShopState) noShopState.style.display = 'block';
            
            // Revenue section show/hide
            const revSection = document.getElementById('shopRevenueSection');
            if (revSection) revSection.style.display = 'none';
            const noRevState = document.getElementById('noShopRevenueState');
            if (noRevState) noRevState.style.display = 'block';
            
            // BUG FIX: Initialize default map for new shop creator!
            initShopMap(null, null);
        }
    } catch (error) {
        console.error("Error fetching shop profile:", error);
    }
}

function populateCategoryDropdowns() {
    const addDropdown = document.getElementById('prodCategory');
    const editDropdown = document.getElementById('editProdCategory');
    
    let optionsHtml = '<option value="" disabled selected>اختر قسم المنتج...</option>';
    allCategories.forEach(cat => {
        optionsHtml += `<option value="${cat.id}">${cat.name}</option>`;
    });
    
    if (addDropdown) addDropdown.innerHTML = optionsHtml;
    if (editDropdown) editDropdown.innerHTML = optionsHtml;
}

function populateShopForm(shop) {
    document.getElementById('shopName').value = shop.name || '';
    document.getElementById('shopAddress').value = shop.address || '';
    document.getElementById('shopLatitude').value = shop.latitude || '';
    document.getElementById('shopLongitude').value = shop.longitude || '';
    document.getElementById('shopDesc').value = shop.description || '';
    document.getElementById('shopOpeningTime').value = shop.opening_time ? shop.opening_time.substring(0, 5) : '';
    document.getElementById('shopClosingTime').value = shop.closing_time ? shop.closing_time.substring(0, 5) : '';
    document.getElementById('shopIsOpen').checked = shop.is_open;
    
    // Update sidebar brand text
    const sidebarShopName = document.getElementById('sidebarShopName');
    if (sidebarShopName) {
        sidebarShopName.innerText = shop.name || 'محلي';
    }

    // Update status stat card
    const statShopStatus = document.getElementById('statShopStatus');
    if (statShopStatus) {
        statShopStatus.innerText = shop.is_open ? 'مفتوح' : 'مغلق';
        statShopStatus.className = shop.is_open ? 'stat-value text-success' : 'stat-value text-danger';
    }

    if (!shop.is_open) {
        const badge = document.getElementById('shopStatusBadge');
        if (badge) badge.classList.remove('d-none');
    }

    if (shop.image) {
        document.getElementById('shopImagePreview').innerHTML = `<img src="${shop.image}" class="w-100 h-100 object-fit-cover">`;
    } else {
        const initialsEl = document.getElementById('shopInitials');
        if (initialsEl) initialsEl.innerText = shop.name ? shop.name.charAt(0) : 'ص';
    }

    // Initialize Map with current shop coordinates
    initShopMap(shop.latitude, shop.longitude);
}

async function handleShopSubmit() {
    const token = localStorage.getItem('access_token');
    const saveBtn = document.getElementById('saveShopBtn');
    const statusMsg = document.getElementById('shopStatusMsg');
    
    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ...';

    const formData = new FormData();
    formData.append('name', document.getElementById('shopName').value);
    formData.append('address', document.getElementById('shopAddress').value);
    
    const lat = document.getElementById('shopLatitude').value;
    const lon = document.getElementById('shopLongitude').value;
    if (lat) formData.append('latitude', lat);
    if (lon) formData.append('longitude', lon);

    formData.append('description', document.getElementById('shopDesc').value);
    formData.append('opening_time', document.getElementById('shopOpeningTime').value || '');
    formData.append('closing_time', document.getElementById('shopClosingTime').value || '');
    formData.append('is_open', document.getElementById('shopIsOpen').checked);
    if (newShopImageFile) {
        formData.append('image', newShopImageFile);
    }

    try {
        let savedShop;
        if (currentShopId) {
            savedShop = await api.shops.updateShop(token, currentShopId, formData);
            statusMsg.innerText = 'تم تحديث المحل بنجاح!';
        } else {
            savedShop = await api.shops.createShop(token, formData);
            currentShopId = savedShop.id;
            statusMsg.innerText = 'تم إنشاء المحل بنجاح!';
            document.getElementById('shopTitle').innerText = 'إعدادات المحل';
            
            const prodSec = document.getElementById('productsSection');
            if (prodSec) prodSec.style.display = 'block';
            const noState = document.getElementById('noShopProductsState');
            if (noState) noState.style.display = 'none';
            
            loadShopProducts(savedShop.id);
            loadShopOrders();
        }
        statusMsg.className = 'text-success text-center fw-bold mt-2';
        statusMsg.classList.remove('d-none');
        
        // Ensure UI updates properly
        populateShopForm(savedShop);
    } catch (error) {
        statusMsg.className = 'text-danger text-center fw-bold mt-2';
        statusMsg.innerText = 'خطأ: ' + JSON.stringify(error);
        statusMsg.classList.remove('d-none');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ بيانات المحل';
        setTimeout(() => statusMsg.classList.add('d-none'), 5000);
    }
}

async function loadShopProducts(shopId) {
    try {
        const products = await api.shops.getProducts(shopId);
        renderShopProductsManagement(products);
    } catch (error) {
        console.error("Error loading products:", error);
    }
}

let currentProductsPage = 1;
const PRODUCTS_PAGE_SIZE = 4;

window.changeProductsPage = function(page) {
    currentProductsPage = page;
    renderShopProductsManagement(currentProducts);
};

function renderShopProductsManagement(products) {
    currentProducts = products;
    
    // Update dashboard statistics
    const statProductCount = document.getElementById('statProductCount');
    if (statProductCount) {
        statProductCount.innerText = products.length;
    }
    const sidebarProductBadge = document.getElementById('sidebarProductBadge');
    if (sidebarProductBadge) {
        sidebarProductBadge.innerText = products.length;
    }

    const container = document.getElementById('shopProductsList');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up">
                <div class="empty-state-icon"><i class="bi bi-box-seam"></i></div>
                <p class="fw-bold">لا توجد منتجات حالياً</p>
                <p class="small text-mesa">ابدأ بإضافة منتجاتك من الزر أعلاه</p>
            </div>`;
        const paginationContainer = document.getElementById('shopProductsPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    // Calculate pagination slice
    const totalItems = products.length;
    const totalPages = Math.ceil(totalItems / PRODUCTS_PAGE_SIZE);
    if (currentProductsPage > totalPages) {
        currentProductsPage = Math.max(1, totalPages);
    }
    
    const startIndex = (currentProductsPage - 1) * PRODUCTS_PAGE_SIZE;
    const endIndex = Math.min(startIndex + PRODUCTS_PAGE_SIZE, totalItems);
    const slicedProducts = products.slice(startIndex, endIndex);

    slicedProducts.forEach(product => {
        const html = `
            <div class="col-md-6 mb-3">
                <div class="product-manage-card h-100">
                    <div class="row g-0 h-100">
                        <div class="col-4 p-2">
                            ${product.image ? 
                                `<img src="${product.image}" class="img-fluid rounded-3 h-100 object-fit-cover w-100">` : 
                                `<div class="rounded-3 h-100 d-flex align-items-center justify-content-center" style="background: linear-gradient(135deg, var(--color-dune-dark), var(--color-terracotta)); min-height: 100px;">
                                    <i class="bi bi-image text-white fs-4"></i>
                                </div>`
                            }
                        </div>
                        <div class="col-8">
                            <div class="card-body py-2 pe-3 ps-1 d-flex flex-column h-100">
                                <h6 class="fw-bold text-espresso mb-1">${product.name}</h6>
                                <p class="product-price mb-1">${product.price} ج.م</p>
                                <p class="mb-1 text-mesa small" style="font-size: 0.8rem;"><i class="bi bi-boxes text-marigold me-1"></i>الكمية بالمخزن: <strong>${product.quantity}</strong> قطع</p>
                                <div class="d-flex gap-2 flex-wrap mb-2">
                                    <span class="badge ${product.available ? 'bg-success' : 'bg-danger'} w-fit-content rounded-pill">
                                        <i class="bi ${product.available ? 'bi-check-circle' : 'bi-x-circle'} me-1"></i>
                                        ${product.available ? 'متوفر' : 'غير متوفر'}
                                    </span>
                                    ${product.category_name ? `
                                        <span class="badge bg-secondary-subtle text-mesa w-fit-content rounded-pill border border-light-subtle" style="font-size: 0.72rem;">
                                            <i class="bi bi-tag-fill text-marigold me-1"></i>${product.category_name}
                                        </span>
                                    ` : ''}
                                </div>
                                <div class="d-flex gap-2 mt-auto">
                                    <button onclick="openEditModal(${product.id})" class="btn btn-sm btn-outline-mesa flex-grow-1 rounded-pill">
                                        <i class="bi bi-pencil me-1"></i>تعديل
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });

    if (window.renderClientPagination) {
        window.renderClientPagination('shopProductsPagination', totalItems, currentProductsPage, PRODUCTS_PAGE_SIZE, 'window.changeProductsPage');
    }
}

window.openEditModal = function(id) {
    const product = currentProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById('editProdId').value = product.id;
    document.getElementById('editProdName').value = product.name;
    document.getElementById('editProdPrice').value = product.price;
    document.getElementById('editProdQuantity').value = product.quantity;
    
    // Pre-select current category
    const editCatDropdown = document.getElementById('editProdCategory');
    if (editCatDropdown) {
        editCatDropdown.value = product.category || "";
    }

    document.getElementById('editProdDesc').value = product.description || '';
    document.getElementById('editProdAvailable').checked = product.available;
    newEditProdImageFile = null;
    document.getElementById('editProdImage').value = '';

    const modalEl = document.getElementById('editProductModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function handleProductEditSubmit() {
    const token = localStorage.getItem('access_token');
    const saveBtn = document.getElementById('saveEditProdBtn');
    const id = document.getElementById('editProdId').value;

    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ...';

    const formData = new FormData();
    formData.append('name', document.getElementById('editProdName').value);
    formData.append('price', document.getElementById('editProdPrice').value);
    formData.append('quantity', document.getElementById('editProdQuantity').value);
    
    // Add selected category ID
    const catVal = document.getElementById('editProdCategory').value;
    if (catVal) {
        formData.append('category', catVal);
    }

    formData.append('description', document.getElementById('editProdDesc').value);
    formData.append('available', document.getElementById('editProdAvailable').checked);

    if (newEditProdImageFile) {
        formData.append('image', newEditProdImageFile);
    }

    try {
        await api.shops.updateProduct(token, id, formData);
        
        // Hide Modal
        const modalEl = document.getElementById('editProductModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
        
        // Reload products
        loadShopProducts(currentShopId);
    } catch (error) {
        alert('حدث خطأ أثناء تعديل المنتج: ' + JSON.stringify(error));
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ التغييرات';
    }
}

async function handleProductDelete() {
    const token = localStorage.getItem('access_token');
    const id = document.getElementById('editProdId').value;

    if (!confirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟")) {
        return;
    }

    try {
        await api.shops.deleteProduct(token, id);
        
        // Hide Modal
        const modalEl = document.getElementById('editProductModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
        
        // Reload products
        loadShopProducts(currentShopId);
    } catch (error) {
        alert('حدث خطأ أثناء حذف المنتج: ' + JSON.stringify(error));
    }
}

async function handleProductSubmit() {
    const token = localStorage.getItem('access_token');
    const saveBtn = document.getElementById('saveProdBtn');
    
    if (!currentShopId) {
        alert("يجب إنشاء محل أولاً");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ...';

    const formData = new FormData();
    formData.append('name', document.getElementById('prodName').value);
    
    // Add selected category ID
    const catVal = document.getElementById('prodCategory').value;
    if (catVal) {
        formData.append('category', catVal);
    }

    formData.append('price', document.getElementById('prodPrice').value);
    formData.append('quantity', document.getElementById('prodQuantity').value);
    formData.append('description', document.getElementById('prodDesc').value);
    formData.append('available', document.getElementById('prodAvailable').checked);
    formData.append('shop', currentShopId);

    if (newProdImageFile) {
        formData.append('image', newProdImageFile);
    }

    try {
        await api.shops.addProduct(token, formData);
        
        // Hide Modal via Bootstrap JS
        const modalEl = document.getElementById('addProductModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
        
        // Reset form
        document.getElementById('productForm').reset();
        newProdImageFile = null;
        
        // Reload products
        loadShopProducts(currentShopId);
    } catch (error) {
        alert('حدث خطأ أثناء إضافة المنتج: ' + JSON.stringify(error));
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ المنتج';
    }
}

let currentOrdersPage = 1;
const ORDERS_PAGE_SIZE = 4;
let currentOrders = [];

window.changeOrdersPage = function(page) {
    currentOrdersPage = page;
    renderShopOrders(currentOrders);
};

async function loadShopOrders() {
    const token = localStorage.getItem('access_token');
    try {
        const orders = await api.orders.getAll(token);
        renderShopOrders(orders);
    } catch (error) {
        console.error("Error loading orders:", error);
        const container = document.getElementById('shopOrdersList');
        if (container) {
            container.innerHTML = `<div class="text-danger text-center w-100">حدث خطأ أثناء تحميل الطلبات</div>`;
        }
    }
}

function renderShopOrders(orders) {
    currentOrders = orders;
    const container = document.getElementById('shopOrdersList');
    if (!container) return;
    
    // Update stats & badges
    const activeOrders = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
    const statActiveOrdersCount = document.getElementById('statActiveOrdersCount');
    if (statActiveOrdersCount) {
        statActiveOrdersCount.innerText = activeOrders.length;
    }
    const sidebarOrderBadge = document.getElementById('sidebarOrderBadge');
    if (sidebarOrderBadge) {
        sidebarOrderBadge.innerText = activeOrders.length;
        if (activeOrders.length === 0) {
            sidebarOrderBadge.classList.add('d-none');
        } else {
            sidebarOrderBadge.classList.remove('d-none');
        }
    }

    container.innerHTML = '';
    
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up">
                <div class="empty-state-icon"><i class="bi bi-receipt"></i></div>
                <p class="fw-bold">لا توجد طلبات حالياً</p>
                <p class="small text-mesa">عندما يقوم العملاء بالطلب من محلك، ستظهر هنا فوراً!</p>
            </div>`;
        const paginationContainer = document.getElementById('shopOrdersPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    // Slicing for pagination
    const totalItems = orders.length;
    const totalPages = Math.ceil(totalItems / ORDERS_PAGE_SIZE);
    if (currentOrdersPage > totalPages) {
        currentOrdersPage = Math.max(1, totalPages);
    }
    
    const startIndex = (currentOrdersPage - 1) * ORDERS_PAGE_SIZE;
    const endIndex = Math.min(startIndex + ORDERS_PAGE_SIZE, totalItems);
    const slicedOrders = orders.slice(startIndex, endIndex);

    slicedOrders.forEach((order, i) => {
        let driverRatingActionHtml = '';
        if (order.status === 'DELIVERED' && order.driver_details) {
            driverRatingActionHtml = `
                <div id="driver-rating-container-${order.id}" class="mt-3"></div>
            `;
        }
        // Status styling
        let statusClass = 'bg-secondary';
        let statusText = 'معلق';
        
        switch(order.status) {
            case 'PENDING':
                statusClass = 'bg-warning text-dark';
                statusText = 'معلق';
                break;
            case 'ACCEPTED':
                statusClass = 'bg-info text-dark';
                statusText = 'مقبول';
                break;
            case 'PREPARING':
                statusClass = 'bg-primary';
                statusText = 'قيد التجهيز';
                break;
            case 'ON_DELIVERY':
                statusClass = 'bg-marigold text-white';
                statusText = 'مع المندوب';
                break;
            case 'DELIVERED':
                statusClass = 'bg-success';
                statusText = 'تم التوصيل';
                break;
            case 'CANCELLED':
                statusClass = 'bg-danger';
                statusText = 'ملغي';
                break;
            case 'PENDING_RETURN':
                statusClass = 'bg-danger text-white animate-pulse';
                statusText = 'مرتجع طوارئ معلق 📥';
                break;
        }

        // Render items list
        let itemsHtml = '';
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                // Filter items to show only items belonging to this shop owner's shop
                if (item.product_details && item.product_details.shop_id !== currentShopId) {
                    return;
                }
                
                const isClickable = ['PENDING', 'ACCEPTED', 'PREPARING'].includes(order.status);
                const badgeClass = item.is_ready ? 'bg-success text-white' : 'bg-warning text-dark';
                const badgeText = item.is_ready ? 'جاهز للاستلام 🟢' : 'تحت التحضير ⏳';
                
                const toggleAction = isClickable 
                    ? `onclick="toggleShopItemReady(${order.id}, ${item.id})"` 
                    : '';
                
                itemsHtml += `
                    <div class="d-flex justify-content-between align-items-center mb-2 border-bottom border-light pb-2 small">
                        <div>
                            <span class="text-espresso fw-bold fs-6">${item.product_details ? item.product_details.name : 'منتج'}</span>
                            <div class="text-mesa" style="font-size: 0.78rem;">الكمية: ${item.quantity} × ${item.price} ج.م</div>
                        </div>
                        <div>
                            <button ${toggleAction} class="btn btn-sm ${badgeClass} rounded-pill px-3 py-1 fw-bold border-0 shadow-sm" style="font-size: 0.78rem; transition: all 0.2s;" ${!isClickable ? 'disabled' : ''}>
                                ${badgeText}
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        // Action buttons
        let actionsHtml = '';
        if (order.status === 'PENDING') {
            actionsHtml = `
                <button onclick="updateOrderStatus(${order.id}, 'ACCEPTED')" class="btn btn-sm btn-success rounded-pill px-3">
                    <i class="bi bi-check-lg me-1"></i>قبول الطلب
                </button>
                <button onclick="updateOrderStatus(${order.id}, 'CANCELLED')" class="btn btn-sm btn-outline-danger rounded-pill px-3 ms-2">
                    <i class="bi bi-x-lg me-1"></i>رفض
                </button>
            `;
        } else if (order.status === 'ACCEPTED') {
            actionsHtml = `
                <button onclick="updateOrderStatus(${order.id}, 'PREPARING')" class="btn btn-sm btn-primary rounded-pill px-3">
                    <i class="bi bi-hourglass-split me-1"></i>بدء التجهيز
                </button>
                <button onclick="updateOrderStatus(${order.id}, 'CANCELLED')" class="btn btn-sm btn-outline-danger rounded-pill px-2 ms-2">إلغاء</button>
            `;
        } else if (order.status === 'PREPARING') {
            actionsHtml = `
                <button onclick="updateOrderStatus(${order.id}, 'ON_DELIVERY')" class="btn btn-sm btn-marigold rounded-pill px-3 text-white">
                    <i class="bi bi-truck me-1"></i>تسليم للمندوب
                </button>
            `;
        } else if (order.status === 'ON_DELIVERY') {
            actionsHtml = `
                <span class="text-muted small"><i class="bi bi-truck me-1"></i>المندوب: ${order.driver_details ? order.driver_details.name : 'جاري التحديد'}</span>
            `;
        } else if (order.status === 'PENDING_RETURN') {
            const driverPhone = order.driver_details ? order.driver_details.phone : 'غير معروف';
            const driverName = order.driver_details ? order.driver_details.name : 'المندوب';
            actionsHtml = `
                <div class="d-flex flex-column gap-2 mt-2 w-100">
                    <span class="text-danger small fw-bold"><i class="bi bi-exclamation-triangle-fill me-1"></i>الطيار ${driverName} (${driverPhone}) أبلغ عن حالة طارئة. العهدة حالياً معه حتى يقوم بإرجاعها إليك!</span>
                    <button onclick="confirmEmergencyReturned(${order.id})" class="btn btn-sm btn-danger rounded-pill px-3 fw-bold text-white shadow-sm w-100 py-2">
                        <i class="bi bi-arrow-counterclockwise me-1"></i>تأكيد استلام المنتجات وتنشيط المندوب 📥
                    </button>
                </div>
            `;
        } else if (order.status === 'DELIVERED') {
            if (order.dispute_status === 'PENDING') {
                actionsHtml = `
                    <div class="alert alert-danger py-2 rounded-3 small mb-0 border-0 fw-bold mt-2">
                        <i class="bi bi-exclamation-octagon me-1"></i>الطلب قيد النزاع والمراجعة بواسطة إدارة بركة للفصل بين الطرفين.
                    </div>
                `;
            } else {
                const hasPaidThisShop = order.paid_shops && order.paid_shops.split(',').includes(String(currentShopId));
                if (hasPaidThisShop) {
                    actionsHtml = `
                        <span class="badge bg-success-subtle text-success rounded-pill px-3 py-2 small fw-bold"><i class="bi bi-wallet2 me-1"></i>تم استلام وتصفية الحساب</span>
                    `;
                } else if (!order.is_paid_to_shop) {
                    // Calculate shop-specific products total share
                    const shopItems = order.items.filter(item => item.product_details && item.product_details.shop_id === currentShopId);
                    const shopShare = shopItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
                    
                    const postponedShopsList = order.postponed_shops ? order.postponed_shops.split(',') : [];
                    const isPostponed = postponedShopsList.includes(String(currentShopId));
                    
                    actionsHtml = `
                        <div class="d-flex flex-column gap-2 mt-2">
                            ${isPostponed ? `
                                <span class="text-warning small fw-bold"><i class="bi bi-door-closed-fill me-1"></i>تم تأجيل السداد مؤقتاً بواسطة الطيار لإغلاق المحل 🚪</span>
                            ` : `
                                <span class="text-danger small fw-bold"><i class="bi bi-exclamation-circle-fill me-1"></i>الطيار استلم المبلغ ولم يقم بتصفيته معك بعد!</span>
                            `}
                            <div class="d-flex gap-2">
                                <button onclick="confirmShopPaymentReceived(${order.id}, ${shopShare})" class="btn btn-sm btn-success rounded-pill px-3 fw-bold text-white shadow-sm flex-grow-1">
                                    <i class="bi bi-cash me-1"></i>تأكيد وتصفية الحساب (${shopShare} ج.م)
                                </button>
                                <button onclick="raiseOrderDispute(${order.id})" class="btn btn-sm btn-outline-danger rounded-pill px-2">
                                    <i class="bi bi-exclamation-octagon"></i>نزاع
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    actionsHtml = `
                        <span class="badge bg-success-subtle text-success rounded-pill px-3 py-2 small fw-bold"><i class="bi bi-wallet2 me-1"></i>تم استلام وتصفية الحساب</span>
                    `;
                }
            }
        } else {
            actionsHtml = `<span class="text-muted small"><i class="bi bi-info-circle me-1"></i>لا توجد إجراءات معلقة</span>`;
        }

        const dateFormatted = new Date(order.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

        const html = `
            <div class="col-md-6 mb-3 animate-up" style="animation-delay: ${i * 0.05}s;">
                <div class="dashboard-card p-3 h-100 d-flex flex-column border" style="background-color: rgba(255,255,255,0.7); border-color: rgba(201,153,151,0.12) !important;">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="fw-bold text-espresso">الطلب #${order.id}</span>
                        <span class="badge ${statusClass} rounded-pill px-2 py-1">${statusText}</span>
                    </div>
                    
                    <div class="mb-3">
                        <div class="text-muted small mb-1"><i class="bi bi-person me-1"></i>العميل: <strong class="text-espresso">${order.customer_details ? order.customer_details.name : 'غير معروف'}</strong> (${order.customer_details ? order.customer_details.phone : ''})</div>
                        <div class="text-muted small mb-1"><i class="bi bi-geo-alt me-1"></i>عنوان التوصيل: <strong class="text-espresso">${order.address || 'العنوان الافتراضي'}</strong></div>
                        <div class="text-muted small mb-2"><i class="bi bi-clock me-1"></i>التاريخ: ${dateFormatted}</div>
                    </div>
                    
                    <div class="bg-white rounded-3 p-2 mb-3 flex-grow-1" style="border: 1px solid rgba(201,153,151,0.08);">
                        <div class="text-muted small mb-2 border-bottom pb-1 fw-bold">تفاصيل المنتجات:</div>
                        ${itemsHtml}
                        <div class="d-flex justify-content-between align-items-center mt-2 fw-bold text-espresso pt-1">
                            <span>الإجمالي:</span>
                            <span class="text-marigold">${order.total_price} ج.م</span>
                        </div>
                    </div>
                    
                    ${driverRatingActionHtml}
                    
                    <div class="d-flex justify-content-between align-items-center mt-auto border-top pt-2">
                        ${actionsHtml}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });

    // Initialize Ratings in the loop
    slicedOrders.forEach((order) => {
        if (order.status === 'DELIVERED' && order.driver_details) {
            initDriverOrderRating(order.id);
        }
    });

    if (window.renderClientPagination) {
        window.renderClientPagination('shopOrdersPagination', totalItems, currentOrdersPage, ORDERS_PAGE_SIZE, 'window.changeOrdersPage');
    }
}

window.updateOrderStatus = async function(orderId, newStatus) {
    const token = localStorage.getItem('access_token');
    try {
        await api.orders.updateStatus(token, orderId, newStatus);
        loadShopOrders();
    } catch (error) {
        alert('حدث خطأ أثناء تحديث حالة الطلب: ' + JSON.stringify(error));
    }
}

// ==========================================
// Leaflet.js Map Geolocation Integration
// ==========================================
let shopMapInstance = null;
let shopMarkerInstance = null;

function initShopMap(lat, lon) {
    const latVal = parseFloat(lat) || 30.0444; // Default to Cairo area
    const lonVal = parseFloat(lon) || 31.2357;

    const mapContainer = document.getElementById('shopMap');
    if (!mapContainer) return;

    if (shopMapInstance) {
        // Map is already initialized, just fly/pan and reposition current marker
        shopMapInstance.setView([latVal, lonVal], 14);
        if (shopMarkerInstance) {
            shopMarkerInstance.setLatLng([latVal, lonVal]);
        } else {
            shopMarkerInstance = L.marker([latVal, lonVal], { draggable: true }).addTo(shopMapInstance);
            bindMarkerDragEvent();
        }
        return;
    }

    // Initialize Leaflet Map
    shopMapInstance = L.map('shopMap').setView([latVal, lonVal], 14);

    // Add High-Quality Leaflet OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(shopMapInstance);

    // Create Draggable Pin Marker
    shopMarkerInstance = L.marker([latVal, lonVal], { draggable: true }).addTo(shopMapInstance);
    bindMarkerDragEvent();

    // Bind click anywhere on the map to pin position
    shopMapInstance.on('click', (e) => {
        const newLat = e.latlng.lat;
        const newLon = e.latlng.lng;
        shopMarkerInstance.setLatLng([newLat, newLon]);
        syncMapToCoordinatesFields(newLat, newLon);
    });

    // Attach listeners to manual coordinate input fields for full two-way binding
    const latInput = document.getElementById('shopLatitude');
    const lonInput = document.getElementById('shopLongitude');
    
    if (latInput && lonInput) {
        latInput.addEventListener('input', syncInputsToMap);
        lonInput.addEventListener('input', syncInputsToMap);
    }
}

function bindMarkerDragEvent() {
    if (shopMarkerInstance) {
        shopMarkerInstance.on('dragend', () => {
            const pos = shopMarkerInstance.getLatLng();
            syncMapToCoordinatesFields(pos.lat, pos.lng);
        });
    }
}

function syncMapToCoordinatesFields(lat, lon) {
    const latInput = document.getElementById('shopLatitude');
    const lonInput = document.getElementById('shopLongitude');
    if (latInput) latInput.value = lat.toFixed(6);
    if (lonInput) lonInput.value = lon.toFixed(6);
}

function syncInputsToMap() {
    const latVal = parseFloat(document.getElementById('shopLatitude').value);
    const lonVal = parseFloat(document.getElementById('shopLongitude').value);
    if (!isNaN(latVal) && !isNaN(lonVal)) {
        if (shopMarkerInstance && shopMapInstance) {
            shopMarkerInstance.setLatLng([latVal, lonVal]);
            shopMapInstance.setView([latVal, lonVal]);
        }
    }
}

// Override or hook window.switchTab to fix Leaflet size recalculation issue
document.addEventListener('DOMContentLoaded', () => {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabId) {
        if (originalSwitchTab) {
            originalSwitchTab(tabId);
        }
        
        // Leaflet maps render improperly in hidden divs. Force invalidation on tab display
        if (tabId === 'settings' && shopMapInstance) {
            setTimeout(() => {
                shopMapInstance.invalidateSize();
            }, 250);
        }
    };
});

window.confirmShopPaymentReceived = async function(orderId, totalPrice) {
    const token = localStorage.getItem('access_token');
    
    // Attempt QR Code Scan first
    let driverOtp = await showBarakaQRScanner('مسح رمز QR الخاص بالطيار 💰');
    
    // Fallback to manual entry if cancelled or unavailable
    if (!driverOtp) {
        driverOtp = await showBarakaPrompt(`برجاء إدخال رمز تصفية الحساب المكون من 4 أرقام الموضح على شاشة الطيار لتأكيد استلام مبلغ (${totalPrice} ج.م) والتحقق من المعاملة:`, 'مثال: 5678', 'تأكيد تصفية الحساب مع الطيار 💰');
    }
    
    if (!driverOtp) return;
    
    try {
        await api.orders.confirmPaymentReceived(token, orderId, driverOtp);
        await showBarakaAlert('تم التحقق وتصفية الحساب بنجاح!', 'info', 'تمت التصفية بنجاح ✅');
        loadShopOrders(); // Reload orders list
    } catch (error) {
        await showBarakaAlert('فشل تصفية الحساب: ' + (error.detail || JSON.stringify(error)), 'warning', 'خطأ في التصفية ⚠️');
    }
}

window.raiseOrderDispute = async function(orderId) {
    const token = localStorage.getItem('access_token');
    const reason = await showBarakaPrompt('يرجى كتابة سبب تقديم الشكوى بالتفصيل (مثل: الطيار يرفض الدفع، العميل لم يستلم المنتجات، إلخ):', 'اكتب سبب النزاع هنا...', 'تقديم شكوى / نزاع مع المندوب ⚖️');
    if (!reason) return;
    
    try {
        await api.orders.raiseDispute(token, orderId, reason);
        await showBarakaAlert('تم تسجيل الشكوى وإرسالها للإدارة بنجاح! سيتم التواصل معك قريباً للفصل بالنزاع.', 'info', 'تم تسجيل النزاع ⚖️');
        loadShopOrders();
    } catch (error) {
        await showBarakaAlert('فشل تقديم الشكوى: ' + JSON.stringify(error), 'warning', 'خطأ ⚠️');
    }
}

// ==========================================
// Delivery Driver Rating System
// ==========================================
async function initDriverOrderRating(orderId) {
    const token = localStorage.getItem('access_token');
    const container = document.getElementById(`driver-rating-container-${orderId}`);
    if (!container) return;

    try {
        const statusData = await api.orders.getDriverRatingStatus(token, orderId);
        if (!statusData.can_rate) {
            container.innerHTML = '';
            return;
        }

        if (statusData.existing_rating) {
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                stars += `<i class="bi ${i <= statusData.existing_rating.rating ? 'bi-star-fill text-warning' : 'bi-star'} mx-1 fs-5"></i>`;
            }
            container.innerHTML = `
                <div class="p-3 rounded-4 text-center mt-2 border-white-10" style="background: rgba(194, 146, 64, 0.05); border: 1px dashed rgba(194, 146, 64, 0.15) !important;">
                    <div class="fw-bold text-espresso small mb-1"><i class="bi bi-patch-check-fill text-success me-1"></i>تقييمك للطيار (${statusData.driver_name})</div>
                    <div class="mb-1">${stars}</div>
                    ${statusData.existing_rating.review ? `<p class="text-mesa mb-0 small mt-1" style="font-style: italic;">"${statusData.existing_rating.review}"</p>` : ''}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="p-3 rounded-4 mt-2 border-white-10" style="background: rgba(194, 146, 64, 0.04); border: 1px dashed rgba(194, 146, 64, 0.2) !important;">
                    <div class="fw-bold text-espresso small mb-2 text-center">🏆 قيم خدمة توصيل الطيار: ${statusData.driver_name}</div>
                    <div class="d-flex justify-content-center gap-2 mb-3 star-rating-selector" id="driverStars-${orderId}">
                        <i class="bi bi-star cursor-pointer text-muted fs-4" data-value="1" onclick="setDriverStars(${orderId}, 1)"></i>
                        <i class="bi bi-star cursor-pointer text-muted fs-4" data-value="2" onclick="setDriverStars(${orderId}, 2)"></i>
                        <i class="bi bi-star cursor-pointer text-muted fs-4" data-value="3" onclick="setDriverStars(${orderId}, 3)"></i>
                        <i class="bi bi-star cursor-pointer text-muted fs-4" data-value="4" onclick="setDriverStars(${orderId}, 4)"></i>
                        <i class="bi bi-star cursor-pointer text-muted fs-4" data-value="5" onclick="setDriverStars(${orderId}, 5)"></i>
                    </div>
                    <input type="hidden" id="driverRatingValue-${orderId}" value="0">
                    <div class="input-group shadow-none" style="direction: ltr;">
                        <button onclick="submitDriverRating(${orderId})" class="btn btn-sm btn-primary rounded-end-3 px-3 shadow-sm fw-bold border-0" id="driverSubmitBtn-${orderId}">إرسال</button>
                        <input type="text" id="driverReviewText-${orderId}" class="form-control form-control-sm rounded-start-3 shadow-none border-white-10 text-end" style="font-size: 0.85rem;" placeholder="اكتب رأيك بالتوصيل (اختياري)...">
                    </div>
                </div>
            `;
        }
    } catch (err) {
        console.error("Error loading driver rating status for order " + orderId, err);
    }
}

window.setDriverStars = function(orderId, val) {
    const starsContainer = document.getElementById(`driverStars-${orderId}`);
    if (!starsContainer) return;
    
    document.getElementById(`driverRatingValue-${orderId}`).value = val;
    
    const stars = starsContainer.querySelectorAll('i');
    stars.forEach(star => {
        const starVal = parseInt(star.getAttribute('data-value'));
        if (starVal <= val) {
            star.className = 'bi bi-star-fill text-warning cursor-pointer fs-4';
        } else {
            star.className = 'bi bi-star text-muted cursor-pointer fs-4';
        }
    });
}

window.submitDriverRating = async function(orderId) {
    const token = localStorage.getItem('access_token');
    const ratingVal = parseInt(document.getElementById(`driverRatingValue-${orderId}`).value);
    const reviewText = document.getElementById(`driverReviewText-${orderId}`).value;
    const submitBtn = document.getElementById(`driverSubmitBtn-${orderId}`);

    if (!ratingVal || ratingVal < 1 || ratingVal > 5) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى اختيار عدد النجوم أولاً!', 'warning', 'bi-star');
        } else {
            alert('يرجى اختيار عدد النجوم أولاً!');
        }
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;

    try {
        await api.orders.rateDriver(token, orderId, ratingVal, reviewText);
        if (window.showBarakaToast) {
            window.showBarakaToast('تم تقييم الطيار بنجاح! شكراً لمشاركتك.', 'success', 'bi-check-circle-fill');
        }
        initDriverOrderRating(orderId);
    } catch (error) {
        if (window.showBarakaToast) {
            window.showBarakaToast(error.detail || 'فشل إرسال التقييم.', 'warning', 'bi-exclamation-triangle');
        } else {
            alert(error.detail || 'فشل إرسال التقييم.');
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = `إرسال`;
    }
}

window.toggleShopItemReady = async function(orderId, itemId) {
    const token = localStorage.getItem('access_token');
    try {
        await api.orders.toggleItemReady(token, orderId, itemId);
        if (window.showBarakaToast) {
            window.showBarakaToast('تم تحديث حالة جاهزية المنتج بنجاح!', 'success', 'bi-check-circle-fill');
        }
        loadShopOrders();
    } catch (error) {
        alert('حدث خطأ أثناء تحديث جاهزية المنتج: ' + JSON.stringify(error));
    }
}

window.confirmEmergencyReturned = async function(orderId) {
    const token = localStorage.getItem('access_token');
    
    // Quick confirmation dialog
    if (!confirm("هل تؤكد استلام المنتجات المرتجعة للطلب من المندوب وإبراء ذمته المالية برمجياً؟")) {
        return;
    }
    
    try {
        await api.orders.confirmEmergencyReturned(token, orderId);
        if (window.showBarakaToast) {
            window.showBarakaToast('تم تأكيد استلام العهدة المرتجعة وتنشيط المندوب بنجاح! تم إرجاع الطلب للبحث عن طيار بديل.', 'success', 'bi-check-circle-fill');
        } else {
            alert('تم تأكيد استلام العهدة المرتجعة وتنشيط المندوب بنجاح!');
        }
        loadShopOrders();
    } catch (error) {
        alert('حدث خطأ أثناء تأكيد استلام العهدة المرتجعة: ' + JSON.stringify(error));
    }
}
