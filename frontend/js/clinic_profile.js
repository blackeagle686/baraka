let currentClinicId = null;
let newClinicImageFile = null;
let currentServices = [];
let currentAppointments = [];

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token');
    const userRole = localStorage.getItem('user_role');

    if (!token || userRole !== 'DOCTOR') {
        window.location.href = '/html/index.html';
        return;
    }

    initClinicProfile();

    const clinicImageInput = document.getElementById('clinicImage');
    if (clinicImageInput) {
        clinicImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                const max_size = 2 * 1024 * 1024;
                if (file.size > max_size) {
                    alert('حجم الصورة كبير جداً! الحد الأقصى 2 ميجابايت.');
                    e.target.value = '';
                    return;
                }
                newClinicImageFile = file;
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('clinicImagePreview').innerHTML = `<img src="${e.target.result}" class="w-100 h-100 object-fit-cover">`;
                };
                reader.readAsDataURL(newClinicImageFile);
            }
        });
    }

    const clinicForm = document.getElementById('clinicForm');
    if (clinicForm) {
        clinicForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleClinicSubmit();
        });
    }

    const serviceForm = document.getElementById('serviceForm');
    if (serviceForm) {
        serviceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleServiceSubmit();
        });
    }

    const editServiceForm = document.getElementById('editServiceForm');
    if (editServiceForm) {
        editServiceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleServiceEditSubmit();
        });
    }

    const deleteServiceBtn = document.getElementById('deleteServiceBtn');
    if (deleteServiceBtn) {
        deleteServiceBtn.addEventListener('click', async () => {
            await handleServiceDelete();
        });
    }

    const manualSlotForm = document.getElementById('manualSlotForm');
    if (manualSlotForm) {
        manualSlotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleManualSlotSubmit();
        });
    }
});

async function initClinicProfile() {
    const token = localStorage.getItem('access_token');
    try {
        const clinic = await api.clinics.getMyClinic(token);
        if (clinic) {
            currentClinicId = clinic.id;
            populateClinicForm(clinic);

            document.getElementById('servicesSection').style.display = 'block';
            document.getElementById('noClinicServicesState').style.display = 'none';

            document.getElementById('slotsSection').style.display = 'block';
            document.getElementById('noClinicSlotsState').style.display = 'none';

            const revSection = document.getElementById('clinicRevenueSection');
            if (revSection) revSection.style.display = 'block';
            const noRevState = document.getElementById('noClinicRevenueState');
            if (noRevState) noRevState.style.display = 'none';

            loadClinicServices();
            loadClinicAppointments();
            startClinicAutoRefresh();
            loadCurrentSlots();
        } else {
            document.getElementById('clinicSettingsTitle').innerText = 'إنشاء عيادة جديدة';
            document.getElementById('servicesSection').style.display = 'none';
            document.getElementById('noClinicServicesState').style.display = 'block';
            document.getElementById('slotsSection').style.display = 'none';
            document.getElementById('noClinicSlotsState').style.display = 'block';
            document.getElementById('clinicRevenueSection').style.display = 'none';
            document.getElementById('noClinicRevenueState').style.display = 'block';

            initClinicMap(null, null);
        }
    } catch (error) {
        console.error("Error fetching clinic profile:", error);
    }
}

function populateClinicForm(clinic) {
    document.getElementById('clinicName').value = clinic.name || '';
    document.getElementById('clinicSpecialization').value = clinic.specialization || '';
    document.getElementById('clinicAddress').value = clinic.address || '';
    document.getElementById('clinicPhone').value = clinic.phone || '';
    document.getElementById('clinicLatitude').value = clinic.latitude || '';
    document.getElementById('clinicLongitude').value = clinic.longitude || '';
    document.getElementById('clinicDesc').value = clinic.description || '';
    document.getElementById('clinicOpeningTime').value = clinic.opening_time ? clinic.opening_time.substring(0, 5) : '';
    document.getElementById('clinicClosingTime').value = clinic.closing_time ? clinic.closing_time.substring(0, 5) : '';
    document.getElementById('clinicIsOpen').checked = clinic.is_open;

    const sidebarName = document.getElementById('sidebarClinicName');
    if (sidebarName) sidebarName.innerText = clinic.name || 'عيادتي';

    const statusEl = document.getElementById('statClinicStatus');
    if (statusEl) {
        statusEl.innerText = clinic.is_open ? 'مفتوحة' : 'مغلقة';
        statusEl.className = clinic.is_open ? 'stat-value text-success' : 'stat-value text-danger';
    }

    if (!clinic.is_open) {
        const badge = document.getElementById('clinicStatusBadge');
        if (badge) badge.classList.remove('d-none');
    }

    if (clinic.image) {
        document.getElementById('clinicImagePreview').innerHTML = `<img src="${clinic.image}" class="w-100 h-100 object-fit-cover">`;
    } else {
        const initialsEl = document.getElementById('clinicInitials');
        if (initialsEl) initialsEl.innerText = clinic.name ? clinic.name.charAt(0) : 'ع';
    }

    initClinicMap(clinic.latitude, clinic.longitude);
}

async function handleClinicSubmit() {
    const token = localStorage.getItem('access_token');
    const saveBtn = document.getElementById('saveClinicBtn');
    const statusMsg = document.getElementById('clinicStatusMsg');

    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ...';

    const formData = new FormData();
    formData.append('name', document.getElementById('clinicName').value);
    formData.append('specialization', document.getElementById('clinicSpecialization').value);
    formData.append('address', document.getElementById('clinicAddress').value);
    formData.append('phone', document.getElementById('clinicPhone').value);

    const lat = document.getElementById('clinicLatitude').value;
    const lon = document.getElementById('clinicLongitude').value;
    if (lat) formData.append('latitude', lat);
    if (lon) formData.append('longitude', lon);

    formData.append('description', document.getElementById('clinicDesc').value);
    formData.append('opening_time', document.getElementById('clinicOpeningTime').value || '');
    formData.append('closing_time', document.getElementById('clinicClosingTime').value || '');
    formData.append('is_open', document.getElementById('clinicIsOpen').checked);
    if (newClinicImageFile) {
        formData.append('image', newClinicImageFile);
    }

    try {
        let savedClinic;
        if (currentClinicId) {
            savedClinic = await api.clinics.updateClinic(token, currentClinicId, formData);
            statusMsg.innerText = 'تم تحديث العيادة بنجاح!';
        } else {
            savedClinic = await api.clinics.createClinic(token, formData);
            currentClinicId = savedClinic.id;
            statusMsg.innerText = 'تم إنشاء العيادة بنجاح!';
            document.getElementById('clinicSettingsTitle').innerText = 'إعدادات العيادة';

            document.getElementById('servicesSection').style.display = 'block';
            document.getElementById('noClinicServicesState').style.display = 'none';
            document.getElementById('slotsSection').style.display = 'block';
            document.getElementById('noClinicSlotsState').style.display = 'none';

            loadClinicServices();
            loadClinicAppointments();
        }
        statusMsg.className = 'text-success text-center fw-bold mt-2';
        statusMsg.classList.remove('d-none');
        populateClinicForm(savedClinic);
    } catch (error) {
        statusMsg.className = 'text-danger text-center fw-bold mt-2';
        statusMsg.innerText = 'خطأ: ' + JSON.stringify(error);
        statusMsg.classList.remove('d-none');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ بيانات العيادة';
        setTimeout(() => statusMsg.classList.add('d-none'), 5000);
    }
}

// ==========================================
// Services Management
// ==========================================
async function loadClinicServices() {
    if (!currentClinicId) return;
    try {
        const services = await api.services.getAll(currentClinicId);
        currentServices = services;
        renderServicesManagement(services);

        const statServiceCount = document.getElementById('statServiceCount');
        if (statServiceCount) statServiceCount.innerText = services.length;

        populateManualSlotServiceSelect(services);
    } catch (error) {
        console.error("Error loading services:", error);
    }
}

let currentServicesPage = 1;
const SERVICES_PAGE_SIZE = 4;

window.changeServicesPage = function(page) {
    currentServicesPage = page;
    renderServicesManagement(currentServices);
};

function renderServicesManagement(services) {
    const container = document.getElementById('servicesManagementList');
    if (!container) return;

    container.innerHTML = '';

    if (services.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up">
                <div class="empty-state-icon"><i class="bi bi-prescription2"></i></div>
                <p class="fw-bold">لا توجد خدمات حالياً</p>
                <p class="small text-mesa">أضف خدماتك من الزر أعلاه</p>
            </div>`;
        const paginationContainer = document.getElementById('servicesPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const totalItems = services.length;
    const totalPages = Math.ceil(totalItems / SERVICES_PAGE_SIZE);
    if (currentServicesPage > totalPages) currentServicesPage = Math.max(1, totalPages);

    const startIndex = (currentServicesPage - 1) * SERVICES_PAGE_SIZE;
    const endIndex = Math.min(startIndex + SERVICES_PAGE_SIZE, totalItems);
    const slicedServices = services.slice(startIndex, endIndex);

    slicedServices.forEach(service => {
        const html = `
            <div class="col-md-6 mb-3">
                <div class="product-manage-card h-100 p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="fw-bold text-espresso mb-1">${service.name}</h6>
                            <p class="text-mesa small mb-2" style="font-size: 0.8rem;">${service.description || ''}</p>
                        </div>
                        <span class="badge ${service.is_active ? 'bg-success' : 'bg-danger'} rounded-pill">
                            ${service.is_active ? 'متاحة' : 'غير متاحة'}
                        </span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="fw-bold" style="color: var(--color-marigold); font-size: 1.1rem;">${service.price} ج.م</span>
                            <span class="text-mesa small me-2"><i class="bi bi-clock me-1"></i>${service.duration_minutes} د</span>
                        </div>
                        <button onclick="openEditServiceModal(${service.id})" class="btn btn-sm btn-outline-mesa rounded-pill px-3">
                            <i class="bi bi-pencil me-1"></i>تعديل
                        </button>
                    </div>
                </div>
            </div>`;
        container.innerHTML += html;
    });

    if (window.renderClientPagination) {
        window.renderClientPagination('servicesPagination', totalItems, currentServicesPage, SERVICES_PAGE_SIZE, 'window.changeServicesPage');
    }
}

window.openEditServiceModal = function(id) {
    const service = currentServices.find(s => s.id === id);
    if (!service) return;

    document.getElementById('editServiceId').value = service.id;
    document.getElementById('editServiceName').value = service.name;
    document.getElementById('editServicePrice').value = service.price;
    document.getElementById('editServiceDuration').value = service.duration_minutes;
    document.getElementById('editServiceDesc').value = service.description || '';
    document.getElementById('editServiceActive').checked = service.is_active;

    const modalEl = document.getElementById('editServiceModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

async function handleServiceSubmit() {
    const token = localStorage.getItem('access_token');
    const saveBtn = document.getElementById('saveServiceBtn');

    if (!currentClinicId) {
        alert("يجب إنشاء عيادة أولاً");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ...';

    const formData = new FormData();
    formData.append('name', document.getElementById('serviceName').value);
    formData.append('price', document.getElementById('servicePrice').value);
    formData.append('duration_minutes', document.getElementById('serviceDuration').value);
    formData.append('description', document.getElementById('serviceDesc').value);
    formData.append('is_active', document.getElementById('serviceActive').checked);

    try {
        await api.services.create(token, formData);
        const modalEl = document.getElementById('addServiceModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
        document.getElementById('serviceForm').reset();
        loadClinicServices();
    } catch (error) {
        alert('حدث خطأ: ' + JSON.stringify(error));
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ الخدمة';
    }
}

async function handleServiceEditSubmit() {
    const token = localStorage.getItem('access_token');
    const saveBtn = document.getElementById('saveEditServiceBtn');
    const id = document.getElementById('editServiceId').value;

    saveBtn.disabled = true;
    saveBtn.innerText = 'جاري الحفظ...';

    const formData = new FormData();
    formData.append('name', document.getElementById('editServiceName').value);
    formData.append('price', document.getElementById('editServicePrice').value);
    formData.append('duration_minutes', document.getElementById('editServiceDuration').value);
    formData.append('description', document.getElementById('editServiceDesc').value);
    formData.append('is_active', document.getElementById('editServiceActive').checked);

    try {
        await api.services.update(token, id, formData);
        const modalEl = document.getElementById('editServiceModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
        loadClinicServices();
    } catch (error) {
        alert('حدث خطأ: ' + JSON.stringify(error));
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'حفظ التغييرات';
    }
}

async function handleServiceDelete() {
    const token = localStorage.getItem('access_token');
    const id = document.getElementById('editServiceId').value;

    if (!confirm("هل أنت متأكد من حذف هذه الخدمة؟")) return;

    try {
        await api.services.delete(token, id);
        const modalEl = document.getElementById('editServiceModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
        loadClinicServices();
    } catch (error) {
        alert('حدث خطأ: ' + JSON.stringify(error));
    }
}

// ==========================================
// Appointments Management
// ==========================================
let currentAppointmentsPage = 1;
const APPOINTMENTS_PAGE_SIZE = 4;

window.changeAppointmentsPage = function(page) {
    currentAppointmentsPage = page;
    renderAppointments(currentAppointments);
};

async function loadClinicAppointments() {
    const token = localStorage.getItem('access_token');
    try {
        const appointments = await api.appointments.getAll(token);
        renderAppointments(appointments);
    } catch (error) {
        console.error("Error loading appointments:", error);
        const container = document.getElementById('appointmentsList');
        if (container) {
            container.innerHTML = `<div class="text-danger text-center w-100">حدث خطأ أثناء تحميل المواعيد</div>`;
        }
    }
}

function renderAppointments(appointments) {
    currentAppointments = appointments;
    const container = document.getElementById('appointmentsList');
    if (!container) return;

    const activeAppointments = appointments.filter(a => a.status === 'PENDING' || a.status === 'CONFIRMED');
    const statPending = document.getElementById('statPendingAppointments');
    if (statPending) statPending.innerText = activeAppointments.length;

    const sidebarBadge = document.getElementById('sidebarAppointmentBadge');
    if (sidebarBadge) {
        sidebarBadge.innerText = activeAppointments.length;
        if (activeAppointments.length === 0) sidebarBadge.classList.add('d-none');
        else sidebarBadge.classList.remove('d-none');
    }

    container.innerHTML = '';

    if (appointments.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up">
                <div class="empty-state-icon"><i class="bi bi-calendar-check"></i></div>
                <p class="fw-bold">لا توجد مواعيد حالياً</p>
                <p class="small text-mesa">عندما يقوم المرضى بالحجز، ستظهر هنا فوراً!</p>
            </div>`;
        const paginationContainer = document.getElementById('appointmentsPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const totalItems = appointments.length;
    const totalPages = Math.ceil(totalItems / APPOINTMENTS_PAGE_SIZE);
    if (currentAppointmentsPage > totalPages) currentAppointmentsPage = Math.max(1, totalPages);

    const startIndex = (currentAppointmentsPage - 1) * APPOINTMENTS_PAGE_SIZE;
    const endIndex = Math.min(startIndex + APPOINTMENTS_PAGE_SIZE, totalItems);
    const slicedAppointments = appointments.slice(startIndex, endIndex);

    slicedAppointments.forEach((apt, i) => {
        let statusClass = 'bg-secondary';
        let statusText = 'معلق';

        switch (apt.status) {
            case 'PENDING':
                statusClass = 'bg-warning text-dark';
                statusText = 'معلق';
                break;
            case 'CONFIRMED':
                statusClass = 'bg-info text-dark';
                statusText = 'مؤكد';
                break;
            case 'COMPLETED':
                statusClass = 'bg-success';
                statusText = 'مكتمل';
                break;
            case 'CANCELLED':
                statusClass = 'bg-danger';
                statusText = 'ملغي';
                break;
        }

        let actionsHtml = '';
        if (apt.status === 'PENDING') {
            actionsHtml = `
                <button onclick="updateAppointmentStatus(${apt.id}, 'CONFIRMED')" class="btn btn-sm btn-success rounded-pill px-3">
                    <i class="bi bi-check-lg me-1"></i>تأكيد
                </button>
                <button onclick="updateAppointmentStatus(${apt.id}, 'CANCELLED')" class="btn btn-sm btn-outline-danger rounded-pill px-3 ms-2">
                    <i class="bi bi-x-lg me-1"></i>إلغاء
                </button>`;
        } else if (apt.status === 'CONFIRMED') {
            actionsHtml = `
                <button onclick="updateAppointmentStatus(${apt.id}, 'COMPLETED')" class="btn btn-sm btn-primary rounded-pill px-3">
                    <i class="bi bi-check-all me-1"></i>إتمام الزيارة
                </button>
                <button onclick="updateAppointmentStatus(${apt.id}, 'CANCELLED')" class="btn btn-sm btn-outline-danger rounded-pill px-2 ms-2">إلغاء</button>`;
        } else if (apt.status === 'COMPLETED') {
            actionsHtml = `<span class="badge bg-success-subtle text-success rounded-pill px-3 py-2 small fw-bold"><i class="bi bi-check-circle me-1"></i>تمت الزيارة</span>`;
        } else {
            actionsHtml = `<span class="text-muted small">تم الإلغاء</span>`;
        }

        const dateFormatted = new Date(apt.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

        const html = `
            <div class="col-md-6 mb-3 animate-up" style="animation-delay: ${i * 0.05}s;">
                <div class="dashboard-card p-3 h-100 d-flex flex-column border" style="background-color: rgba(255,255,255,0.7); border-color: rgba(201,153,151,0.12) !important;">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="fw-bold text-espresso">حجز #${apt.id}</span>
                        <span class="badge ${statusClass} rounded-pill px-2 py-1">${statusText}</span>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small mb-1"><i class="bi bi-person me-1"></i>المريض: <strong>${apt.patient_name || apt.patient_phone || 'غير معروف'}</strong></div>
                        <div class="text-muted small mb-1"><i class="bi bi-telephone me-1"></i>الهاتف: ${apt.patient_phone || ''}</div>
                        <div class="text-muted small mb-1"><i class="bi bi-calendar me-1"></i>التاريخ: ${apt.date}</div>
                        <div class="text-muted small mb-1"><i class="bi bi-clock me-1"></i>الموعد: ${apt.start_time ? apt.start_time.substring(0,5) : ''} - ${apt.end_time ? apt.end_time.substring(0,5) : ''}</div>
                        <div class="text-muted small mb-1"><i class="bi bi-prescription me-1"></i>الخدمة: ${apt.service_name || 'غير محدد'}</div>
                        <div class="fw-bold mt-2" style="color: var(--color-marigold);">${apt.price} ج.م</div>
                        ${apt.notes ? `<div class="text-mesa small mt-1 bg-light rounded-3 p-2"><i class="bi bi-chat-dots me-1"></i>${apt.notes}</div>` : ''}
                    </div>
                    <div class="d-flex align-items-center mt-auto border-top pt-2">
                        ${actionsHtml}
                    </div>
                </div>
            </div>`;
        container.innerHTML += html;
    });

    if (window.renderClientPagination) {
        window.renderClientPagination('appointmentsPagination', totalItems, currentAppointmentsPage, APPOINTMENTS_PAGE_SIZE, 'window.changeAppointmentsPage');
    }
}

window.updateAppointmentStatus = async function(appointmentId, newStatus) {
    const token = localStorage.getItem('access_token');
    try {
        await api.appointments.updateStatus(token, appointmentId, newStatus);
        loadClinicAppointments();
        if (window.showBarakaToast) {
            window.showBarakaToast('تم تحديث حالة الموعد بنجاح!', 'success', 'bi-check-circle');
        }
    } catch (error) {
        alert('حدث خطأ: ' + JSON.stringify(error));
    }
};

// ==========================================
// Auto-Refresh Engine
// ==========================================
let clinicRefreshCountdownTimer = null;
let clinicRefreshSecondsLeft = 15;

function startClinicAutoRefresh() {
    if (clinicRefreshCountdownTimer) clearInterval(clinicRefreshCountdownTimer);

    const indicatorEl = document.getElementById('clinicAutoRefreshIndicator');
    const countdownEl = document.getElementById('clinicRefreshCountdown');

    if (!indicatorEl || !countdownEl) return;

    indicatorEl.style.display = 'flex';
    clinicRefreshSecondsLeft = 15;
    countdownEl.innerText = clinicRefreshSecondsLeft;

    clinicRefreshCountdownTimer = setInterval(() => {
        clinicRefreshSecondsLeft--;
        if (countdownEl) countdownEl.innerText = clinicRefreshSecondsLeft;
        if (clinicRefreshSecondsLeft <= 0) {
            clearInterval(clinicRefreshCountdownTimer);
            clinicRefreshCountdownTimer = null;
            loadClinicAppointments().finally(() => {
                startClinicAutoRefresh();
            });
        }
    }, 1000);
}

window.manualRefreshAppointments = function() {
    const iconEl = document.getElementById('clinicRefreshIcon');
    if (iconEl) iconEl.classList.add('bi-arrow-clockwise-spin');

    if (clinicRefreshCountdownTimer) {
        clearInterval(clinicRefreshCountdownTimer);
        clinicRefreshCountdownTimer = null;
    }

    loadClinicAppointments().finally(() => {
        if (iconEl) iconEl.classList.remove('bi-arrow-clockwise-spin');
        if (window.showBarakaToast) {
            window.showBarakaToast('تم تحديث المواعيد بنجاح!', 'success', 'bi-arrow-clockwise');
        }
        startClinicAutoRefresh();
    });
};

// ==========================================
// Slots Management
// ==========================================
function populateManualSlotServiceSelect(services) {
    const select = document.getElementById('manualSlotService');
    if (!select) return;
    let html = '<option value="">أي خدمة</option>';
    services.forEach(s => {
        html += `<option value="${s.id}">${s.name} (${s.duration_minutes} د)</option>`;
    });
    select.innerHTML = html;
}

async function generateSlots() {
    if (!currentClinicId) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يجب إنشاء عيادة أولاً.', 'warning', 'bi-exclamation-triangle');
        }
        return;
    }
    const token = localStorage.getItem('access_token');
    const startDate = document.getElementById('slotsStartDate').value;
    const endDate = document.getElementById('slotsEndDate').value;

    if (!startDate || !endDate) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى تحديد تاريخ البداية والنهاية.', 'warning', 'bi-exclamation-triangle');
        }
        return;
    }

    try {
        const result = await api.clinics.generateSlots(token, currentClinicId, startDate, endDate);
        if (window.showBarakaToast) {
            window.showBarakaToast(result.message || 'تم إنشاء المواعيد بنجاح!', 'success', 'bi-check-circle');
        }
        loadCurrentSlots();
    } catch (error) {
        const msg = error?.detail || error?.message || JSON.stringify(error);
        if (window.showBarakaToast) {
            window.showBarakaToast(msg, 'error', 'bi-exclamation-triangle');
        } else {
            alert('خطأ: ' + msg);
        }
    }
}

async function handleManualSlotSubmit() {
    const token = localStorage.getItem('access_token');
    const date = document.getElementById('manualSlotDate').value;
    const start = document.getElementById('manualSlotStart').value;
    const end = document.getElementById('manualSlotEnd').value;
    const serviceId = document.getElementById('manualSlotService').value;

    if (!date || !start || !end) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى ملء جميع الحقول.', 'warning', 'bi-exclamation-triangle');
        }
        return;
    }

    const formData = new FormData();
    formData.append('date', date);
    formData.append('start_time', start);
    formData.append('end_time', end);
    formData.append('is_available', true);
    formData.append('is_auto_generated', false);
    if (serviceId) formData.append('service', serviceId);

    try {
        await fetch(`/api/time-slots/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (window.showBarakaToast) {
            window.showBarakaToast('تم إضافة الموعد يدوياً!', 'success', 'bi-plus-circle');
        }
        document.getElementById('manualSlotForm').reset();
        loadCurrentSlots();
    } catch (error) {
        alert('خطأ: ' + JSON.stringify(error));
    }
}

async function loadCurrentSlots() {
    if (!currentClinicId) return;
    const filterDate = document.getElementById('filterSlotsDate')?.value || '';
    const container = document.getElementById('currentSlotsList');
    if (!container) return;

    try {
        let url = '/api/time-slots/?clinic_id=' + currentClinicId;
        if (filterDate) url += '&date=' + filterDate;

        const res = await fetch(url);
        if (!res.ok) throw await res.json();
        const slots = await res.json();

        if (slots.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-4 text-mesa">
                    <i class="bi bi-clock-history fs-1 opacity-50 mb-2 d-block"></i>
                    <p class="fw-bold">لا توجد مواعيد متاحة</p>
                    <p class="small">استخدم "إنشاء المواعيد تلقائياً" أعلاه</p>
                </div>`;
            return;
        }

        container.innerHTML = '';
        slots.forEach(slot => {
            const html = `
                <div class="col-4 col-md-3 col-lg-2">
                    <div class="time-slot-card ${!slot.is_available ? 'opacity-50' : ''}" style="${!slot.is_available ? 'background: #f8d7da; border-color: #f5c2c7;' : ''}">
                        <span class="time-slot-time">${slot.date}</span>
                        <span class="time-slot-duration">${slot.start_time?.substring(0,5) || ''}</span>
                        <span class="badge ${slot.is_available ? 'bg-success' : 'bg-danger'} d-block mt-1" style="font-size: 0.6rem;">
                            ${slot.is_available ? 'متاح' : 'محجوز'}
                        </span>
                    </div>
                </div>`;
            container.innerHTML += html;
        });
    } catch (error) {
        console.error("Error loading slots:", error);
        container.innerHTML = `<div class="col-12 text-center text-danger">خطأ في تحميل المواعيد</div>`;
    }
}

// ==========================================
// Leaflet.js Map Integration
// ==========================================
let clinicMapInstance = null;
let clinicMarkerInstance = null;

function initClinicMap(lat, lon) {
    const latVal = parseFloat(lat) || 30.0444;
    const lonVal = parseFloat(lon) || 31.2357;

    const mapContainer = document.getElementById('clinicMap');
    if (!mapContainer) return;

    if (clinicMapInstance) {
        clinicMapInstance.setView([latVal, lonVal], 14);
        if (clinicMarkerInstance) {
            clinicMarkerInstance.setLatLng([latVal, lonVal]);
        } else {
            clinicMarkerInstance = L.marker([latVal, lonVal], { draggable: true }).addTo(clinicMapInstance);
            bindClinicMarkerDrag();
        }
        return;
    }

    clinicMapInstance = L.map('clinicMap').setView([latVal, lonVal], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(clinicMapInstance);

    clinicMarkerInstance = L.marker([latVal, lonVal], { draggable: true }).addTo(clinicMapInstance);
    bindClinicMarkerDrag();

    clinicMapInstance.on('click', (e) => {
        const newLat = e.latlng.lat;
        const newLon = e.latlng.lng;
        clinicMarkerInstance.setLatLng([newLat, newLon]);
        syncClinicMapToFields(newLat, newLon);
    });

    const latInput = document.getElementById('clinicLatitude');
    const lonInput = document.getElementById('clinicLongitude');
    if (latInput && lonInput) {
        latInput.addEventListener('input', syncClinicInputsToMap);
        lonInput.addEventListener('input', syncClinicInputsToMap);
    }
}

function bindClinicMarkerDrag() {
    if (clinicMarkerInstance) {
        clinicMarkerInstance.on('dragend', () => {
            const pos = clinicMarkerInstance.getLatLng();
            syncClinicMapToFields(pos.lat, pos.lng);
        });
    }
}

function syncClinicMapToFields(lat, lon) {
    const latInput = document.getElementById('clinicLatitude');
    const lonInput = document.getElementById('clinicLongitude');
    if (latInput) latInput.value = lat.toFixed(6);
    if (lonInput) lonInput.value = lon.toFixed(6);
}

function syncClinicInputsToMap() {
    const latVal = parseFloat(document.getElementById('clinicLatitude').value);
    const lonVal = parseFloat(document.getElementById('clinicLongitude').value);
    if (!isNaN(latVal) && !isNaN(lonVal)) {
        if (clinicMarkerInstance && clinicMapInstance) {
            clinicMarkerInstance.setLatLng([latVal, lonVal]);
            clinicMapInstance.setView([latVal, lonVal]);
        }
    }
}
