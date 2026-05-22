document.addEventListener('DOMContentLoaded', () => {
    const isDetailsPage = window.location.pathname.includes('details.html');
    if (isDetailsPage) {
        initClinicDetails();
    } else {
        initClinicsList();
    }
});

let allFetchedClinics = [];
let currentPage = 1;
let currentSearch = '';
let isOpenFilter = false;
let searchDebounceTimer = null;

async function initClinicsList(page = 1) {
    try {
        currentPage = page;
        const response = await api.clinics.getAll(currentPage, currentSearch);
        const clinics = response.results || response;
        allFetchedClinics = clinics;
        renderFilteredClinics();
        renderClinicsMap(clinics);
        renderPagination(response);
        setupFilters();
    } catch (error) {
        console.error("Error fetching clinics:", error);
    }
}

window.initClinicsList = initClinicsList;

function renderFilteredClinics() {
    let filtered = allFetchedClinics;
    if (isOpenFilter) {
        filtered = allFetchedClinics.filter(c => c.is_open);
    }
    renderAllClinics(filtered);
}

function setupFilters() {
    const searchInput = document.getElementById('clinicSearchInput');
    const openNowFilter = document.getElementById('openNowFilter');
    if (!searchInput || !openNowFilter) return;

    searchInput.oninput = () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            currentSearch = searchInput.value;
            initClinicsList(1);
        }, 300);
    };

    openNowFilter.onchange = () => {
        isOpenFilter = openNowFilter.checked;
        renderFilteredClinics();
    };
}

function renderPagination(response) {
    const container = document.getElementById('clinicsPagination');
    if (!container) return;
    container.innerHTML = '';

    if (!response.count || response.count <= 6) {
        container.classList.add('d-none');
        return;
    }
    container.classList.remove('d-none');

    const totalPages = Math.ceil(response.count / 6);
    let paginationHtml = '';

    if (currentPage > 1) {
        paginationHtml += `
            <button class="btn btn-outline-mesa rounded-pill btn-sm px-3 py-1 fw-bold" onclick="initClinicsList(${currentPage - 1})">
                السابق <i class="bi bi-chevron-left ms-1"></i>
            </button>`;
    } else {
        paginationHtml += `
            <button class="btn btn-outline-mesa rounded-pill btn-sm px-3 py-1 fw-bold disabled" style="opacity: 0.5;">
                السابق <i class="bi bi-chevron-left ms-1"></i>
            </button>`;
    }

    paginationHtml += `
        <span class="fw-bold text-espresso small mx-2">
            صفحة <span class="text-marigold">${currentPage}</span> من ${totalPages}
        </span>`;

    if (currentPage < totalPages) {
        paginationHtml += `
            <button class="btn btn-outline-mesa rounded-pill btn-sm px-3 py-1 fw-bold" onclick="initClinicsList(${currentPage + 1})">
                التالي <i class="bi bi-chevron-right me-1"></i>
            </button>`;
    } else {
        paginationHtml += `
            <button class="btn btn-outline-mesa rounded-pill btn-sm px-3 py-1 fw-bold disabled" style="opacity: 0.5;">
                التالي <i class="bi bi-chevron-right me-1"></i>
            </button>`;
    }
    container.innerHTML = paginationHtml;
}

function renderAllClinics(clinics) {
    const container = document.getElementById('allClinicsList');
    if (!container) return;

    const countNum = document.getElementById('clinicsCountNum');
    if (countNum) countNum.innerText = clinics.length;

    container.innerHTML = '';

    if (clinics.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100 animate-up text-center py-5">
                <div class="empty-state-icon mb-3" style="font-size: 3rem; color: var(--color-mesa);"><i class="bi bi-heart-pulse"></i></div>
                <p class="fw-bold text-espresso fs-5">مالقينّاش عيادات هنا!</p>
                <p class="small text-mesa">جرب تدور بحاجة تانية أو غير الفلاتر</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="list-section-label"><i class="bi bi-grid-3x3-gap me-1"></i>${clinics.length} عيادة متاحة</div>
        <div class="row g-3" id="clinicsGridRow"></div>`;

    const gridRow = document.getElementById('clinicsGridRow');
    if (!gridRow) return;

    clinics.forEach((clinic, i) => {
        const rating = clinic.average_rating !== undefined ? Number(clinic.average_rating).toFixed(1) : '0.0';
        const specialization = clinic.specialization || 'عيادة عامة';

        const clinicHtml = `
            <div class="col-6 col-sm-6 col-lg-4 col-xxl-3 animate-up" style="animation-delay: ${i * 0.08}s;">
                <a href="/html/clinics/details.html?id=${clinic.id}" class="shop-card-split h-100 d-flex flex-column mb-0">
                    <div class="shop-card-split-img">
                        <span class="shop-rating-badge">
                            <i class="bi bi-star-fill text-warning"></i>
                            ${rating}
                        </span>
                        ${clinic.image 
                            ? `<img src="${clinic.image}" class="w-100 h-100 object-fit-cover">` 
                            : `<div class="d-flex h-100 align-items-center justify-content-center text-white fw-bold fs-2" style="background: linear-gradient(135deg, var(--color-terracotta), var(--color-mesa));">
                                <i class="bi bi-heart-pulse"></i>
                               </div>`
                        }
                        <span class="badge ${clinic.is_open ? 'bg-success' : 'bg-danger'} position-absolute bottom-0 start-0 m-2 rounded-pill px-2" style="font-size: 0.7rem; z-index: 5;">
                            ${clinic.is_open ? 'مفتوح' : 'مغلق'}
                        </span>
                    </div>
                    <div class="shop-card-split-body d-flex flex-column flex-grow-1">
                        <div class="shop-card-split-category">${specialization}</div>
                        <h5 class="shop-card-split-name mb-3">${clinic.name}</h5>
                        <p class="text-mesa small mb-2" style="font-size: 0.78rem; min-height: 2rem;">
                            ${clinic.doctor_name ? `<i class="bi bi-person-fill me-1"></i>د. ${clinic.doctor_name}` : ''}
                        </p>
                        <button class="shop-card-split-btn mt-auto">
                             احجز موعد <i class="bi bi-arrow-left-short fs-5"></i>
                        </button>
                    </div>
                </a>
            </div>`;
        gridRow.innerHTML += clinicHtml;
    });
}

// ==========================================
// Interactive Map
// ==========================================
let directoryMapInstance = null;
let directoryMarkersGroup = [];

function renderClinicsMap(clinics) {
    const mapContainer = document.getElementById('clinicsDirectoryMap');
    if (!mapContainer) return;

    const pinnedClinics = clinics.filter(c => c.latitude && c.longitude);

    const countBadge = document.getElementById('activeClinicsMapCount');
    if (countBadge) {
        countBadge.innerText = `موجود ${pinnedClinics.length} عيادات على الخريطة`;
    }

    if (pinnedClinics.length === 0) {
        mapContainer.innerHTML = `
            <div class="d-flex align-items-center justify-content-center h-100 bg-light text-muted">
                <div class="text-center py-5">
                    <i class="bi bi-geo-alt-fill fs-1 text-mesa mb-2 animate-up"></i>
                    <p class="mb-0 fw-bold">مافيش عيادات على الخريطة دلوقتي</p>
                    <p class="small text-mesa mt-1">تصفح العيادات المتاحة في القائمة الجانبية</p>
                </div>
            </div>`;
        return;
    }

    const defaultLat = parseFloat(pinnedClinics[0].latitude);
    const defaultLon = parseFloat(pinnedClinics[0].longitude);

    if (directoryMapInstance) {
        directoryMarkersGroup.forEach(marker => directoryMapInstance.removeLayer(marker));
        directoryMarkersGroup = [];
    } else {
        directoryMapInstance = L.map('clinicsDirectoryMap').setView([defaultLat, defaultLon], 13);
        window.directoryMapInstance = directoryMapInstance;

        L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '© Google Satellite'
        }).addTo(directoryMapInstance);
    }

    const bounds = [];

    pinnedClinics.forEach(clinic => {
        const lat = parseFloat(clinic.latitude);
        const lon = parseFloat(clinic.longitude);
        bounds.push([lat, lon]);

        const popupContent = `
            <div class="shop-map-popup text-end" style="font-family: 'Cairo', sans-serif; direction: rtl;">
                <div class="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom" style="border-color: rgba(201,153,151,0.12) !important;">
                    <div style="width: 45px; height: 45px; border-radius: 50%; overflow: hidden; background: #eee; flex-shrink: 0; border: 2px solid rgba(194, 146, 64, 0.15);">
                        ${clinic.image 
                            ? `<img src="${clinic.image}" style="width:100%; height:100%; object-fit:cover;">` 
                            : `<div class="d-flex align-items-center justify-content-center h-100 text-white fw-bold" style="background: linear-gradient(135deg, var(--color-terracotta), var(--color-mesa)); font-size: 0.9rem;"><i class="bi bi-heart-pulse"></i></div>`
                        }
                    </div>
                    <div>
                        <h6 class="fw-bold text-espresso m-0" style="font-size: 0.95rem;">${clinic.name}</h6>
                        <span class="badge ${clinic.is_open ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill px-2 py-0.5 mt-1" style="font-size: 0.7rem;">
                            ${clinic.is_open ? 'مفتوح دلوقتي' : 'مقفول دلوقتي'}
                        </span>
                    </div>
                </div>
                <p class="text-mesa small mb-2" style="font-size: 0.8rem;">${clinic.specialization || 'عيادة عامة'}</p>
                <div class="text-muted small mb-3" style="font-size: 0.8rem;">
                    <i class="bi bi-geo-alt-fill text-marigold me-1"></i>${clinic.address || 'عنوان في القرية'}
                </div>
                <a href="/html/clinics/details.html?id=${clinic.id}" class="btn btn-marigold btn-sm rounded-pill w-100 py-2 fw-bold text-white shadow-sm text-decoration-none">
                    احجز موعد <i class="bi bi-arrow-left-short ms-1"></i>
                </a>
            </div>`;

        const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="map-marker-3d clinic-marker"><div class="marker-pulse-ring"></div></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });

        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(directoryMapInstance)
            .bindPopup(popupContent, { minWidth: 220, closeButton: true });

        directoryMarkersGroup.push(marker);
    });

    window.directoryMapBounds = bounds;
    if (bounds.length > 0) {
        directoryMapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
}

// ==========================================
// Clinic Details Page
// ==========================================
let currentClinic = null;
let currentServices = [];
let selectedSlot = null;

async function initClinicDetails() {
    const params = new URLSearchParams(window.location.search);
    const clinicId = params.get('id');

    if (clinicId) {
        try {
            const clinic = await api.clinics.getById(clinicId);
            currentClinic = clinic;
            renderClinicHeader(clinic);
            renderClinicSidebar(clinic);
            loadClinicServices(clinicId);
            initClinicRatings(clinic);
        } catch (error) {
            console.error("Error:", error);
            const banner = document.getElementById('clinicCoverBanner');
            if (banner) {
                banner.innerHTML = `
                    <div class="shop-cover-banner" style="background-color: var(--color-espresso);">
                        <div class="container py-5 text-center animate-up">
                            <i class="bi bi-exclamation-triangle text-danger fs-1"></i>
                            <h2 class="text-white mt-2">حدث خطأ أثناء تحميل بيانات العيادة</h2>
                        </div>
                    </div>`;
            }
        }
    }
}

function renderClinicHeader(clinic) {
    const bannerContainer = document.getElementById('clinicCoverBanner');
    if (!bannerContainer) return;

    let coverPhoto = clinic.image || 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?q=80&w=1200';
    const rating = clinic.average_rating !== undefined ? Number(clinic.average_rating).toFixed(1) : '0.0';
    const totalRatings = clinic.total_ratings !== undefined ? clinic.total_ratings : 0;
    const specialization = clinic.specialization || 'عيادة عامة';

    bannerContainer.innerHTML = `
        <div class="shop-cover-banner" style="background-image: linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.75)), url('${coverPhoto}');">
            <div class="container pb-4 w-100 animate-up">
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb m-0 mb-3">
                        <li class="breadcrumb-item"><a href="/html/clinics/list.html" class="text-white-50 text-decoration-none fw-bold"><i class="bi bi-arrow-right-short"></i> الرجوع للعيادات</a></li>
                    </ol>
                </nav>
                <h1 class="shop-cover-title text-white fw-bold mb-3">${clinic.name}</h1>
                <div class="shop-cover-badges">
                    <span class="shop-cover-badge-item">
                        <i class="bi bi-star-fill text-warning me-1"></i>
                        <span>${rating} (${totalRatings} تقييم)</span>
                    </span>
                    <span class="shop-cover-badge-item">
                        <i class="bi bi-tag-fill"></i>
                        <span>${specialization}</span>
                    </span>
                    <span class="shop-cover-badge-item">
                        <i class="bi ${clinic.is_open ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}"></i>
                        <span class="${clinic.is_open ? 'text-success' : 'text-danger'}">${clinic.is_open ? 'مفتوح دلوقتي' : 'مقفول دلوقتي'}</span>
                    </span>
                </div>
            </div>
        </div>`;
}

function renderClinicSidebar(clinic) {
    const container = document.getElementById('clinicInfoSidebar');
    if (!container) return;

    const openingHours = clinic.opening_time && clinic.closing_time
        ? `${clinic.opening_time.substring(0, 5)} - ${clinic.closing_time.substring(0, 5)}`
        : 'غير محدد';

    container.innerHTML = `
        <div class="text-center mb-4">
            <div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; margin: 0 auto; background: linear-gradient(135deg, var(--color-terracotta), var(--color-mesa));" class="mb-3">
                ${clinic.image 
                    ? `<img src="${clinic.image}" class="w-100 h-100 object-fit-cover">` 
                    : `<div class="d-flex h-100 align-items-center justify-content-center text-white fs-2"><i class="bi bi-heart-pulse"></i></div>`
                }
            </div>
            <h5 class="fw-bold text-espresso mb-1">${clinic.name}</h5>
            <p class="text-mesa small mb-2">${clinic.specialization || 'عيادة عامة'}</p>
        </div>
        <hr class="opacity-25">
        <div class="mb-3">
            <p class="mb-2 small"><i class="bi bi-person-fill text-marigold me-2"></i><strong>الدكتور:</strong> ${clinic.doctor_name || 'غير محدد'}</p>
            <p class="mb-2 small"><i class="bi bi-telephone-fill text-marigold me-2"></i><strong>الهاتف:</strong> ${clinic.phone || clinic.doctor_phone || 'غير محدد'}</p>
            <p class="mb-2 small"><i class="bi bi-geo-alt-fill text-marigold me-2"></i><strong>العنوان:</strong> ${clinic.address || 'غير محدد'}</p>
            <p class="mb-2 small"><i class="bi bi-clock-fill text-marigold me-2"></i><strong>مواعيد العمل:</strong> ${openingHours}</p>
            <p class="mb-0 small"><i class="bi bi-chat-dots text-marigold me-2"></i><strong>الوصف:</strong> ${clinic.description || 'لا يوجد وصف'}</p>
        </div>`;
}

async function loadClinicServices(clinicId) {
    try {
        currentServices = await api.services.getAll(clinicId);
        renderServices(currentServices);
        populateBookingServiceSelect(currentServices);
    } catch (error) {
        console.error("Error loading services:", error);
    }
}

function renderServices(services) {
    const container = document.getElementById('servicesList');
    if (!container) return;

    if (services.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-mesa">
                <i class="bi bi-prescription2 fs-1 opacity-50 mb-2 d-block"></i>
                <p class="fw-bold">لم يتم إضافة خدمات بعد</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    services.forEach((service, i) => {
        const html = `
            <div class="col-md-6 animate-up" style="animation-delay: ${i * 0.05}s;">
                <div class="product-card h-100 p-3 d-flex flex-column justify-content-between" style="background: white; border-radius: 18px; border: 1px solid rgba(201,153,151,0.1);">
                    <div>
                        <h6 class="fw-bold text-espresso mb-1">${service.name}</h6>
                        <p class="text-mesa small mb-2" style="min-height: 1.5rem;">${service.description || ''}</p>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold" style="color: var(--color-marigold); font-size: 1.1rem;">${service.price} ج.م</span>
                        <span class="badge bg-secondary-subtle text-mesa rounded-pill px-3 py-1 fw-bold" style="font-size: 0.75rem;">
                            <i class="bi bi-clock me-1"></i>${service.duration_minutes} دقيقة
                        </span>
                    </div>
                </div>
            </div>`;
        container.innerHTML += html;
    });
}

function populateBookingServiceSelect(services) {
    const select = document.getElementById('bookingServiceSelect');
    if (!select) return;

    let html = '<option value="" disabled selected>اختر الخدمة أولاً...</option>';
    services.forEach(s => {
        html += `<option value="${s.id}" data-price="${s.price}" data-duration="${s.duration_minutes}">${s.name} - ${s.price} ج.م (${s.duration_minutes} د)</option>`;
    });
    select.innerHTML = html;

    select.onchange = () => {
        const dateInput = document.getElementById('bookingDate');
        if (dateInput && select.value) {
            dateInput.focus();
        }
    };

    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
        dateInput.onchange = () => {
            if (select.value) {
                loadAvailableSlots();
            }
        };
    }
}

async function loadAvailableSlots() {
    const serviceSelect = document.getElementById('bookingServiceSelect');
    const dateInput = document.getElementById('bookingDate');
    const slotsSection = document.getElementById('timeSlotsSection');
    const slotsGrid = document.getElementById('timeSlotsGrid');
    const notesSection = document.getElementById('bookingNotesSection');
    const confirmBtn = document.getElementById('confirmBookingBtn');

    if (!serviceSelect.value || !dateInput.value) return;

    selectedSlot = null;
    slotsSection.style.display = 'block';
    slotsGrid.innerHTML = `
        <div class="col-12 text-center py-3">
            <div class="spinner-border text-marigold" role="status"></div>
            <p class="text-mesa mt-2 small">بنحمل المواعيد المتاحة...</p>
        </div>`;

    try {
        const slots = await api.clinics.getAvailableSlots(
            currentClinic.id,
            dateInput.value,
            serviceSelect.value
        );

        if (slots.length === 0) {
            slotsGrid.innerHTML = `
                <div class="col-12 text-center py-4">
                    <i class="bi bi-clock-history fs-1 text-mesa opacity-50 mb-2 d-block"></i>
                    <p class="fw-bold text-espresso">لا توجد مواعيد متاحة في هذا اليوم</p>
                    <p class="small text-mesa">جرب تختار يوم تاني أو خدمة مختلفة</p>
                </div>`;
            notesSection.style.display = 'none';
            confirmBtn.style.display = 'none';
            return;
        }

        slotsGrid.innerHTML = '';
        slots.forEach(slot => {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'col-4 col-md-3';
            slotDiv.innerHTML = `
                <div class="time-slot-card" data-slot-id="${slot.id}" 
                     data-start="${slot.start_time}" data-end="${slot.end_time}"
                     onclick="selectTimeSlot(this, '${slot.start_time}', '${slot.end_time}', ${slot.id})">
                    <span class="time-slot-time">${slot.start_time.substring(0, 5)}</span>
                    <span class="time-slot-duration">${slot.service ? slot.service.duration_minutes || '' : ''} د</span>
                </div>`;
            slotsGrid.appendChild(slotDiv);
        });

        notesSection.style.display = 'block';
        confirmBtn.style.display = 'none';
    } catch (error) {
        console.error("Error loading slots:", error);
        slotsGrid.innerHTML = `
            <div class="col-12 text-center py-3 text-danger">
                <i class="bi bi-exclamation-triangle fs-1 mb-2 d-block"></i>
                <p>حدث خطأ أثناء تحميل المواعيد</p>
            </div>`;
    }
}

window.selectTimeSlot = function(el, startTime, endTime, slotId) {
    document.querySelectorAll('.time-slot-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedSlot = { id: slotId, start: startTime, end: endTime };

    const confirmBtn = document.getElementById('confirmBookingBtn');
    if (confirmBtn) {
        confirmBtn.style.display = 'block';
        confirmBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i>تأكيد الحجز الساعة ${startTime.substring(0, 5)}`;
    }
};

window.submitBooking = async function() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى تسجيل الدخول أولاً للحجز.', 'warning', 'bi-shield-lock');
        } else {
            alert('يرجى تسجيل الدخول أولاً للحجز.');
        }
        setTimeout(() => {
            window.location.href = `/html/auth/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }, 1500);
        return;
    }

    const serviceSelect = document.getElementById('bookingServiceSelect');
    const dateInput = document.getElementById('bookingDate');
    const notesInput = document.getElementById('bookingNotes');
    const confirmBtn = document.getElementById('confirmBookingBtn');

    if (!serviceSelect.value || !dateInput.value || !selectedSlot) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى اختيار الخدمة والتاريخ والموعد.', 'error', 'bi-exclamation-triangle');
        }
        return;
    }

    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    const price = selectedOption.getAttribute('data-price');

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>جاري الحجز...';

    const bookingData = {
        clinic: currentClinic.id,
        service: parseInt(serviceSelect.value),
        time_slot: selectedSlot.id,
        date: dateInput.value,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        notes: notesInput.value || '',
        price: parseFloat(price)
    };

    try {
        await api.appointments.create(token, bookingData);

        document.getElementById('bookingFormSection').style.display = 'none';
        document.getElementById('bookingSuccessSection').style.display = 'block';

        if (window.showBarakaToast) {
            window.showBarakaToast('تم حجز الموعد بنجاح! في انتظار تأكيد الدكتور.', 'success', 'bi-check-circle');
        }
    } catch (error) {
        let errMsg = 'حدث خطأ أثناء الحجز.';
        if (error && error.detail) errMsg = error.detail;
        else if (typeof error === 'string') errMsg = error;

        if (window.showBarakaToast) {
            window.showBarakaToast(errMsg, 'error', 'bi-exclamation-triangle');
        } else {
            alert(errMsg);
        }
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>تأكيد الحجز';
    }
};

// ==========================================
// Clinic Ratings
// ==========================================
async function initClinicRatings(clinic) {
    const card = document.getElementById('clinicRatingsCard');
    if (!card) return;

    const token = localStorage.getItem('access_token');
    let canRate = false;
    let existingRating = null;

    if (token) {
        try {
            const statusRes = await api.clinics.getRatingStatus(token, clinic.id);
            canRate = statusRes.can_rate;
            existingRating = statusRes.existing_rating;
        } catch (err) {
            console.error("Error fetching rating status:", err);
        }
    }

    renderRatingsCard(clinic, canRate, existingRating);
}

function renderRatingsCard(clinic, canRate, existingRating) {
    const card = document.getElementById('ratingsContent');
    if (!card) return;

    const avgRating = clinic.average_rating || 0.0;
    const totalRatings = clinic.total_ratings || 0;
    const ratingsList = clinic.ratings_list || [];

    let starCounts = [0, 0, 0, 0, 0];
    ratingsList.forEach(r => {
        if (r.rating >= 1 && r.rating <= 5) starCounts[r.rating - 1]++;
    });

    let starsProgressHtml = '';
    for (let i = 5; i >= 1; i--) {
        const count = starCounts[i - 1];
        const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
        starsProgressHtml += `
            <div class="d-flex align-items-center gap-2 mb-1" style="font-size: 0.8rem; direction: ltr;">
                <span class="text-espresso fw-bold" style="width: 12px; text-align: right;">${i}</span>
                <i class="bi bi-star-fill text-warning" style="font-size: 0.75rem;"></i>
                <div class="progress flex-grow-1" style="height: 6px; background-color: rgba(0,0,0,0.06); border-radius: 10px;">
                    <div class="progress-bar bg-warning" role="progressbar" style="width: ${pct}%; border-radius: 10px;"></div>
                </div>
                <span class="text-muted" style="width: 25px; text-align: left;">${count}</span>
            </div>`;
    }

    let ratingStarsHtml = '';
    const fullStars = Math.floor(avgRating);
    const halfStar = avgRating % 1 >= 0.5;
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) ratingStarsHtml += '<i class="bi bi-star-fill text-warning me-1"></i>';
        else if (i === fullStars + 1 && halfStar) ratingStarsHtml += '<i class="bi bi-star-half text-warning me-1"></i>';
        else ratingStarsHtml += '<i class="bi bi-star text-muted me-1"></i>';
    }

    let reviewsListHtml = '';
    if (ratingsList.length === 0) {
        reviewsListHtml = `
            <div class="text-center py-4 text-mesa">
                <i class="bi bi-chat-left-text fs-2 opacity-50 mb-2 d-block"></i>
                <span class="small fw-semibold">مفيش تقييمات للعيادة دي لسه.</span>
            </div>`;
    } else {
        reviewsListHtml = `
            <div class="ratings-list-scroll pe-1 mb-2" style="max-height: 250px; overflow-y: auto;">
                ${ratingsList.map(r => `
                    <div class="review-item border-bottom border-white-10 py-3 text-start">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold text-espresso small">${r.patient_name || 'مريض بركة'}</span>
                            <div class="d-flex gap-1" style="direction: ltr;">
                                ${Array.from({length: r.rating}).map(() => '<i class="bi bi-star-fill text-warning" style="font-size: 0.7rem;"></i>').join('')}
                            </div>
                        </div>
                        ${r.review ? `<p class="text-mesa small mb-0" style="font-size: 0.8rem;">"${r.review}"</p>` : ''}
                    </div>
                `).join('')}
            </div>`;
    }

    let rateFormHtml = '';
    if (canRate && !existingRating) {
        rateFormHtml = `
            <div class="rating-restricted-box text-center mt-3 p-3">
                <p class="fw-bold text-espresso small mb-2">قيم حجزك في العيادة</p>
                <div class="star-rating-selector mb-2 d-flex justify-content-center gap-1" id="clinicStarSelector" style="font-size: 1.5rem;">
                    ${[1,2,3,4,5].map(s => `<i class="bi bi-star text-muted cursor-pointer" data-value="${s}" onclick="setClinicRatingStar(${s})" style="cursor: pointer;"></i>`).join('')}
                </div>
                <input type="hidden" id="clinicRatingValue" value="0">
                <input type="text" class="form-control form-control-sm rounded-pill text-center mb-2" id="clinicReviewText" placeholder="اكتب رأيك (اختياري)" style="font-size: 0.85rem;">
                <button class="btn btn-marigold btn-sm rounded-pill text-white fw-bold px-4" onclick="submitClinicRating(${clinic.id})">إرسال التقييم</button>
            </div>`;
    } else if (existingRating) {
        rateFormHtml = `
            <div class="rating-restricted-box text-center mt-3 p-3">
                <p class="fw-bold text-espresso small mb-2"><i class="bi bi-patch-check-fill text-success me-1"></i>تقييمك</p>
                <div class="mb-1">${[1,2,3,4,5].map(s => `<i class="bi ${s <= existingRating.rating ? 'bi-star-fill text-warning' : 'bi-star'} me-1"></i>`).join('')}</div>
                ${existingRating.review ? `<p class="text-mesa small mb-0">"${existingRating.review}"</p>` : ''}
            </div>`;
    } else if (!canRate) {
        rateFormHtml = `
            <div class="rating-restricted-box text-center mt-3 p-3">
                <p class="text-mesa small mb-0 fw-semibold"><i class="bi bi-shield-lock me-1"></i>يمكنك التقييم بعد حجز وزيارة العيادة</p>
            </div>`;
    }

    let html = `
        <div class="row g-4">
            <div class="col-md-4 text-center">
                <div class="fw-bold" style="font-size: 2.5rem; color: var(--color-espresso);">${avgRating.toFixed(1)}</div>
                <div class="mb-2">${ratingStarsHtml}</div>
                <div class="text-mesa small fw-semibold">${totalRatings} تقييم</div>
                <hr class="my-3 opacity-25">
                ${starsProgressHtml}
            </div>
            <div class="col-md-8">
                ${reviewsListHtml}
                ${rateFormHtml}
            </div>
        </div>`;

    card.innerHTML = html;
}

window.setClinicRatingStar = function(val) {
    document.getElementById('clinicRatingValue').value = val;
    document.querySelectorAll('#clinicStarSelector i').forEach(star => {
        const starVal = parseInt(star.getAttribute('data-value'));
        star.className = starVal <= val ? 'bi bi-star-fill text-warning cursor-pointer' : 'bi bi-star text-muted cursor-pointer';
    });
};

window.submitClinicRating = async function(clinicId) {
    const token = localStorage.getItem('access_token');
    const ratingVal = parseInt(document.getElementById('clinicRatingValue').value);
    const reviewText = document.getElementById('clinicReviewText').value;

    if (!ratingVal || ratingVal < 1 || ratingVal > 5) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى اختيار عدد النجوم أولاً!', 'warning', 'bi-star');
        }
        return;
    }

    try {
        await api.clinics.rateClinic(token, clinicId, ratingVal, reviewText);
        if (window.showBarakaToast) {
            window.showBarakaToast('تم إرسال تقييمك بنجاح!', 'success', 'bi-check-circle');
        }
        const clinic = await api.clinics.getById(clinicId);
        initClinicRatings(clinic);
    } catch (error) {
        if (window.showBarakaToast) {
            window.showBarakaToast(error.detail || 'حدث خطأ.', 'error', 'bi-exclamation-triangle');
        }
    }
};
