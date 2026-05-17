let currentShopId = null;
let newShopImageFile = null;
let newProdImageFile = null;
let newEditProdImageFile = null;

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
                newShopImageFile = e.target.files[0];
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
                newProdImageFile = e.target.files[0];
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
        const shop = await api.shops.getMyShop(token);
        if (shop) {
            currentShopId = shop.id;
            populateShopForm(shop);
            document.getElementById('productsSection').style.display = 'block';
            loadShopProducts(shop.id);
        } else {
            document.getElementById('shopTitle').innerText = 'إنشاء محل جديد';
        }
    } catch (error) {
        console.error("Error fetching shop profile:", error);
    }
}

function populateShopForm(shop) {
    document.getElementById('shopName').value = shop.name || '';
    document.getElementById('shopAddress').value = shop.address || '';
    document.getElementById('shopDesc').value = shop.description || '';
    document.getElementById('shopIsOpen').checked = shop.is_open;
    
    if (!shop.is_open) {
        const badge = document.getElementById('shopStatusBadge');
        badge.classList.remove('d-none');
    }

    if (shop.image) {
        document.getElementById('shopImagePreview').innerHTML = `<img src="${shop.image}" class="w-100 h-100 object-fit-cover">`;
    } else {
        document.getElementById('shopInitials').innerText = shop.name.charAt(0);
    }
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
    formData.append('description', document.getElementById('shopDesc').value);
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
            document.getElementById('productsSection').style.display = 'block';
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

function renderShopProductsManagement(products) {
    const container = document.getElementById('shopProductsList');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p class="text-mesa text-center w-100 mt-3">لا توجد منتجات حالياً. ابدأ بإضافة منتجاتك.</p>';
        return;
    }

    products.forEach(product => {
        const descEscaped = (product.description || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const nameEscaped = product.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const html = `
            <div class="col-md-6 mb-3">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                    <div class="row g-0 h-100">
                        <div class="col-4 p-2">
                            ${product.image ? 
                                `<img src="${product.image}" class="img-fluid rounded-3 h-100 object-fit-cover w-100">` : 
                                `<div class="bg-light rounded-3 h-100 d-flex align-items-center justify-content-center fw-bold text-mesa">صورة</div>`
                            }
                        </div>
                        <div class="col-8">
                            <div class="card-body py-2 pe-3 ps-1 d-flex flex-column h-100">
                                <h6 class="fw-bold text-espresso mb-1">${product.name}</h6>
                                <p class="text-marigold fw-bold mb-1">${product.price} ج.م</p>
                                <span class="badge ${product.available ? 'bg-success' : 'bg-danger'} mb-2 w-fit-content">${product.available ? 'متوفر' : 'غير متوفر'}</span>
                                <div class="d-flex gap-2 mt-auto">
                                    <button onclick="openEditModal(${product.id}, '${nameEscaped}', ${product.price}, '${descEscaped}', ${product.available})" class="btn btn-sm btn-outline-mesa flex-grow-1">تعديل</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

window.openEditModal = function(id, name, price, desc, available) {
    document.getElementById('editProdId').value = id;
    document.getElementById('editProdName').value = name;
    document.getElementById('editProdPrice').value = price;
    document.getElementById('editProdDesc').value = desc;
    document.getElementById('editProdAvailable').checked = available;
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
    formData.append('description', document.getElementById('editProdDesc').value);
    formData.append('available', document.getElementById('editProdAvailable').checked);

    if (newEditProdImageFile) {
        formData.append('image', newEditProdImageFile);
    }

    try {
        await api.shops.updateProduct(token, id, formData);
        
        // Hide Modal
        const modalEl = document.getElementById('editProductModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
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
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
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
    formData.append('price', document.getElementById('prodPrice').value);
    formData.append('description', document.getElementById('prodDesc').value);
    formData.append('shop', currentShopId); // Backend actually forces this based on user, but passing is fine

    if (newProdImageFile) {
        formData.append('image', newProdImageFile);
    }

    try {
        await api.shops.addProduct(token, formData);
        
        // Hide Modal via Bootstrap JS
        const modalEl = document.getElementById('addProductModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
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
