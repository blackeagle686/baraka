let newImageFile = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchProfile();
    
    const imageInput = document.getElementById('image');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                newImageFile = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('profileImagePreview').innerHTML = `<img src="${e.target.result}" class="w-100 h-100 object-fit-cover">`;
                };
                reader.readAsDataURL(newImageFile);
            }
        });
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('access_token');
            const saveBtn = document.getElementById('saveBtn');
            const statusMsg = document.getElementById('statusMsg');
            
            saveBtn.disabled = true;
            saveBtn.innerText = 'جاري الحفظ...';

            const formData = new FormData();
            formData.append('name', document.getElementById('name').value);
            formData.append('phone', document.getElementById('phone').value);
            formData.append('location', document.getElementById('location').value);
            
            const lat = document.getElementById('latitude').value;
            const lon = document.getElementById('longitude').value;
            if (lat) formData.append('latitude', lat);
            if (lon) formData.append('longitude', lon);

            if (newImageFile) {
                formData.append('image', newImageFile);
            }

            try {
                await api.auth.updateProfile(token, formData);
                statusMsg.className = 'text-success text-center fw-bold mt-2';
                statusMsg.innerText = 'تم حفظ التعديلات بنجاح!';
                statusMsg.classList.remove('d-none');
            } catch (error) {
                statusMsg.className = 'text-danger text-center fw-bold mt-2';
                statusMsg.innerText = 'خطأ: ' + JSON.stringify(error);
                statusMsg.classList.remove('d-none');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerText = 'حفظ التعديلات';
                setTimeout(() => statusMsg.classList.add('d-none'), 5000);
            }
        });
    }
});

async function fetchProfile() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/html/auth/login.html';
        return;
    }

    try {
        const data = await api.auth.getProfile(token);
        
        document.getElementById('name').value = data.name || '';
        document.getElementById('phone').value = data.phone || '';
        document.getElementById('location').value = data.location || '';
        document.getElementById('latitude').value = data.latitude || '';
        document.getElementById('longitude').value = data.longitude || '';
        
        const roleMap = {
            'CUSTOMER': 'مشتري',
            'SHOP_OWNER': 'صاحب محل',
            'DRIVER': 'طيار (مندوب توصيل)',
            'ADMIN': 'مدير'
        };
        document.getElementById('role').value = roleMap[data.role] || data.role;

        if (data.role === 'CUSTOMER') {
            const customerOrdersContainer = document.getElementById('customerOrdersContainer');
            if (customerOrdersContainer) {
                customerOrdersContainer.style.display = 'block';
                loadCustomerOrders();
            }
        }

        if (data.image) {
            document.getElementById('profileImagePreview').innerHTML = `<img src="${data.image}" class="w-100 h-100 object-fit-cover">`;
        } else if (data.name) {
            document.getElementById('profileInitials').innerText = data.name.charAt(0);
        } else if (data.phone) {
            document.getElementById('profileInitials').innerText = data.phone.charAt(0);
        }
    } catch (error) {
        if (error.message === 'Unauthorized') {
            localStorage.removeItem('access_token');
            window.location.href = '/html/auth/login.html';
        } else {
            console.error("Failed to fetch profile:", error);
        }
    }
}

async function loadCustomerOrders() {
    const token = localStorage.getItem('access_token');
    try {
        const orders = await api.orders.getAll(token);
        const container = document.getElementById('customerOrdersList');
        const badge = document.getElementById('ordersCountBadge');
        
        if (badge) badge.innerText = `${orders.length} طلب`;
        if (!container) return;
        
        container.innerHTML = '';
        if (orders.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted animate-up">
                    <i class="bi bi-cart-x fs-1 mb-2" style="color: var(--color-mesa);"></i>
                    <p class="mb-0">لم تقم بإرسال أي طلبات بعد!</p>
                </div>
            `;
            return;
        }
        
        const statusMap = {
            'PENDING': { text: 'بانتظار موافقة المحل', class: 'bg-warning text-dark' },
            'ACCEPTED': { text: 'تم القبول', class: 'bg-info text-white' },
            'PREPARING': { text: 'جاري التجهيز', class: 'bg-primary text-white' },
            'ON_DELIVERY': { text: 'مع المندوب للتوصيل', class: 'bg-marigold text-white' },
            'DELIVERED': { text: 'تم التوصيل بنجاح', class: 'bg-success text-white' },
            'CANCELLED': { text: 'ملغي', class: 'bg-danger text-white' }
        };
        
        orders.forEach((order, i) => {
            const dateFormatted = new Date(order.created_at).toLocaleString('ar-EG', {
                hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
            });
            
            const isCompleted = ['DELIVERED', 'CANCELLED'].includes(order.status);
            const statusConfig = statusMap[order.status] || { text: order.status, class: 'bg-secondary text-white' };
            
            let statusBadge = `<span class="badge ${statusConfig.class} rounded-pill px-2 py-1">${statusConfig.text}</span>`;
            if (order.dispute_status === 'PENDING') {
                statusBadge = `<span class="badge bg-danger text-white rounded-pill px-2 py-1">قيد النزاع ⚠️</span>`;
            }
            
            const itemsList = order.items.map(it => `
                <div class="d-flex justify-content-between text-muted small py-1">
                    <span>- ${it.product_details ? it.product_details.name : 'منتج'} (x${it.quantity})</span>
                    <span>${it.price} ج.م</span>
                </div>
            `).join('');
            
        let otpBlockHtml = '';
        if (!isCompleted && order.customer_otp) {
            otpBlockHtml = `
                <div class="bg-marigold bg-opacity-10 border border-marigold border-dashed rounded-3 p-3 text-center mt-3" style="border-style: dashed !important;">
                    <span class="small text-espresso d-block mb-1 fw-bold"><i class="bi bi-shield-lock-fill me-1"></i>رمز التوصيل السري (OTP):</span>
                    <strong class="fs-4 text-marigold tracking-wide" style="font-family: monospace; letter-spacing: 4px;">${order.customer_otp}</strong>
                    <div id="qrcode-customer-${order.id}" class="d-flex justify-content-center my-2"></div>
                    <span class="d-block text-muted small mt-1" style="font-size: 0.75rem;">قم بإعطاء هذا الرمز أو إظهار رمز QR للمندوب عند استلام طلبك ودفع المبلغ لتأكيد المعاملة.</span>
                </div>
            `;
        } else if (order.status === 'DELIVERED' && !order.is_paid_to_shop) {
                otpBlockHtml = `
                    <div class="alert alert-warning py-2 rounded-3 small mb-0 border-0 fw-bold mt-3 text-espresso">
                        <i class="bi bi-clock-history me-1"></i>تم التوصيل بنجاح. بانتظار تصفية المندوب للمبلغ مع المحل.
                    </div>
                `;
            }
            
            if (order.dispute_status === 'PENDING') {
                otpBlockHtml = `
                    <div class="alert alert-danger py-2 rounded-3 small mb-0 border-0 fw-bold mt-3">
                        <i class="bi bi-exclamation-octagon me-1"></i>الطلب قيد النزاع والتحقيق للفصل بين الأطراف بواسطة إدارة بركة.
                    </div>
                `;
            }
            
            let disputeActionHtml = '';
            if (order.dispute_status === 'NONE' && ['ON_DELIVERY', 'DELIVERED'].includes(order.status)) {
                disputeActionHtml = `
                    <button onclick="raiseCustomerDispute(${order.id})" class="btn btn-sm btn-outline-danger rounded-pill w-100 mt-2 fw-bold small py-1">
                        <i class="bi bi-exclamation-octagon me-1"></i>تقديم شكوى بخصوص هذا الطلب
                    </button>
                `;
            }
            
            const html = `
                <div class="card mb-3 border p-3" style="background-color: rgba(255,255,255,0.7); border-color: rgba(201,153,151,0.12) !important;">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold text-espresso">طلب #${order.id}</span>
                        ${statusBadge}
                    </div>
                    <div class="mb-2">
                        <div class="text-muted small"><i class="bi bi-shop me-1"></i>المحل: <strong class="text-espresso">${order.shop_details ? order.shop_details.name : 'محل بركة'}</strong></div>
                        <div class="text-muted small"><i class="bi bi-clock me-1"></i>التاريخ: ${dateFormatted}</div>
                        ${order.driver_details ? `<div class="text-muted small"><i class="bi bi-truck me-1"></i>المندوب: <strong class="text-espresso">${order.driver_details.name}</strong> (${order.driver_details.phone})</div>` : ''}
                    </div>
                    <div class="bg-white rounded-3 p-2 mb-2" style="border: 1px solid rgba(201,153,151,0.08);">
                        <div class="text-muted small mb-1 border-bottom pb-1 fw-bold">المنتجات:</div>
                        ${itemsList}
                        <div class="d-flex justify-content-between align-items-center mt-2 fw-bold text-espresso pt-1 border-top" style="border-color: rgba(201,153,151,0.05) !important;">
                            <span>الإجمالي المطلوب:</span>
                            <span class="text-marigold">${(parseFloat(order.total_price) + (order.driver ? parseFloat(order.delivery_price) : 0)).toFixed(2)} ج.م</span>
                        </div>
                    </div>
                    ${otpBlockHtml}
                    ${disputeActionHtml}
                </div>
            `;
            container.innerHTML += html;
        });
    } catch (error) {
        console.error("Failed to load customer orders:", error);
    }
}

window.raiseCustomerDispute = async function(orderId) {
    const token = localStorage.getItem('access_token');
    const reason = await showBarakaPrompt('يرجى كتابة سبب تقديم الشكوى بالتفصيل (مثلاً: لم أستلم الطلب، المندوب أخذ مبلغاً إضافياً، إلخ):', 'اكتب سبب الشكوى هنا...', 'تقديم شكوى بخصوص الطلب ⚖️');
    if (!reason) return;
    
    try {
        await api.orders.raiseDispute(token, orderId, reason);
        await showBarakaAlert('تم تقديم الشكوى للإدارة بنجاح! سيتم التحقق فوراً للفصل في النزاع.', 'info', 'تم تسجيل الشكوى ⚖️');
        loadCustomerOrders();
    } catch (error) {
        await showBarakaAlert('فشل تقديم الشكوى: ' + JSON.stringify(error), 'warning', 'خطأ ⚠️');
    }
}
