// ==========================================
// Baraka Admin Dashboard Controller
// ==========================================

const TOKEN = localStorage.getItem('access_token');
const ROLE = localStorage.getItem('user_role');

// Guard: only ADMIN can access
if (!TOKEN || ROLE !== 'ADMIN') {
    alert('غير مصرح لك بالدخول إلى لوحة التحكم.');
    window.location.href = '/html/auth/login.html';
}

// ==========================================
// Section Navigation
// ==========================================
function switchSection(section) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

    // Show target
    const target = document.getElementById(`section-${section}`);
    if (target) target.classList.add('active');

    const link = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (link) link.classList.add('active');

    // Close mobile sidebar
    document.querySelector('.admin-sidebar')?.classList.remove('open');

    // Load data for the section
    if (section === 'dashboard') loadStats();
    if (section === 'users') loadUsers(1);
    if (section === 'orders') loadOrders(1);
    if (section === 'reports') loadReports(1);
}

// ==========================================
// Dashboard Stats
// ==========================================
async function loadStats() {
    try {
        const stats = await api.admin.getStats(TOKEN);

        // Update sidebar badges
        if (stats.pending_approvals > 0) {
            document.getElementById('pendingBadge').style.display = 'inline';
            document.getElementById('pendingBadge').textContent = stats.pending_approvals;
        } else {
            document.getElementById('pendingBadge').style.display = 'none';
        }

        if (stats.unresolved_reports > 0) {
            document.getElementById('reportsBadge').style.display = 'inline';
            document.getElementById('reportsBadge').textContent = stats.unresolved_reports;
        } else {
            document.getElementById('reportsBadge').style.display = 'none';
        }

        const grid = document.getElementById('statsGrid');
        grid.innerHTML = `
            <div class="stat-card" style="cursor: pointer;" onclick="navToUsers('', '', '')">
                <span class="stat-icon">👥</span>
                <div class="stat-value">${stats.total_users}</div>
                <div class="stat-label">إجمالي المستخدمين</div>
            </div>
            <div class="stat-card" style="cursor: pointer;" onclick="navToUsers('CUSTOMER', '', '')">
                <span class="stat-icon">🛍️</span>
                <div class="stat-value">${stats.total_customers}</div>
                <div class="stat-label">مشتريين</div>
            </div>
            <div class="stat-card" style="cursor: pointer;" onclick="navToUsers('SHOP_OWNER', '', '')">
                <span class="stat-icon">🏪</span>
                <div class="stat-value">${stats.total_shop_owners}</div>
                <div class="stat-label">أصحاب محلات</div>
            </div>
            <div class="stat-card" style="cursor: pointer;" onclick="navToUsers('DRIVER', '', '')">
                <span class="stat-icon">🛵</span>
                <div class="stat-value">${stats.total_drivers}</div>
                <div class="stat-label">طيارين</div>
            </div>
            <div class="stat-card" style="cursor: pointer;" onclick="navToUsers('', 'false', '')">
                <span class="stat-icon">⏳</span>
                <div class="stat-value">${stats.pending_approvals}</div>
                <div class="stat-label">في انتظار الموافقة</div>
            </div>
            <div class="stat-card" style="cursor: pointer;" onclick="navToUsers('', '', 'false')">
                <span class="stat-icon">🚫</span>
                <div class="stat-value">${stats.blocked_users}</div>
                <div class="stat-label">مستخدمين محظورين</div>
            </div>
            <div class="stat-card" style="cursor: pointer;" onclick="navToOrders('')">
                <span class="stat-icon">📦</span>
                <div class="stat-value">${stats.total_orders}</div>
                <div class="stat-label">إجمالي الطلبات</div>
            </div>
            <div class="stat-card" style="cursor: pointer;" onclick="navToUsers('SHOP_OWNER', 'true', '')">
                <span class="stat-icon">🏬</span>
                <div class="stat-value">${stats.total_shops}</div>
                <div class="stat-label">المحلات (مُلاك)</div>
            </div>
            <div class="stat-card" style="cursor: pointer;" onclick="navToReports('')">
                <span class="stat-icon">📝</span>
                <div class="stat-value">${stats.total_reports}</div>
                <div class="stat-label">التقارير</div>
            </div>
            <div class="stat-card" style="cursor: pointer;" onclick="navToReports('false')">
                <span class="stat-icon">⚠️</span>
                <div class="stat-value">${stats.unresolved_reports}</div>
                <div class="stat-label">تقارير مفتوحة</div>
            </div>
        `;
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

// Quick Navigation Handlers for Stat Cards
function navToUsers(role, approved, active) {
    document.getElementById('userRoleFilter').value = role;
    document.getElementById('userApprovedFilter').value = approved;
    document.getElementById('userActiveFilter').value = active;
    switchSection('users');
}

function navToOrders(status) {
    document.getElementById('orderStatusFilter').value = status;
    switchSection('orders');
}

function navToReports(resolved) {
    document.getElementById('reportResolvedFilter').value = resolved;
    switchSection('reports');
}

// ==========================================
// Users Management
// ==========================================
let userSearchTimer;
function debounceUserSearch() {
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(() => loadUsers(1), 400);
}

async function loadUsers(page = 1) {
    const search = document.getElementById('userSearch').value;
    const role = document.getElementById('userRoleFilter').value;
    const approved = document.getElementById('userApprovedFilter').value;
    const active = document.getElementById('userActiveFilter').value;

    try {
        const data = await api.admin.getUsers(TOKEN, page, search, role, approved, active);
        renderUsersTable(data.results || []);
        renderPagination('usersPagination', data, loadUsers);
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

function getRoleBadge(role) {
    const labels = { CUSTOMER: 'مشتري', SHOP_OWNER: 'صاحب محل', DRIVER: 'طيار', ADMIN: 'أدمن' };
    return `<span class="badge-role ${role.toLowerCase()}">${labels[role] || role}</span>`;
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-people"></i>لا يوجد مستخدمين مطابقين</div></td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const statusBadge = u.is_active
            ? '<span class="badge-status approved">نشط</span>'
            : '<span class="badge-status blocked">محظور</span>';
        const approvalBadge = u.is_approved
            ? '<span class="badge-status approved">معتمد</span>'
            : '<span class="badge-status pending">في الانتظار</span>';

        let actions = '';
        if (!u.is_approved) {
            actions += `<button class="btn-action approve" onclick="approveUser(${u.id})"><i class="bi bi-check-lg"></i> اعتماد</button>`;
        }
        if (u.is_active) {
            actions += `<button class="btn-action block" onclick="blockUser(${u.id})"><i class="bi bi-slash-circle"></i> حظر</button>`;
        } else {
            actions += `<button class="btn-action unblock" onclick="unblockUser(${u.id})"><i class="bi bi-unlock"></i> رفع الحظر</button>`;
        }

        const joinDate = new Date(u.date_joined).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

        return `
            <tr>
                <td>${u.id}</td>
                <td>${u.name || '—'}</td>
                <td style="direction:ltr; text-align:right;">${u.phone}</td>
                <td>${getRoleBadge(u.role)}</td>
                <td>${statusBadge}</td>
                <td>${approvalBadge}</td>
                <td>${joinDate}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

async function approveUser(id) {
    try {
        await api.admin.updateUser(TOKEN, id, { is_approved: true });
        loadUsers();
        loadStats();
    } catch (err) { console.error(err); }
}

async function blockUser(id) {
    if (!confirm('هل أنت متأكد من حظر هذا المستخدم؟')) return;
    try {
        await api.admin.updateUser(TOKEN, id, { is_active: false });
        loadUsers();
        loadStats();
    } catch (err) { console.error(err); }
}

async function unblockUser(id) {
    try {
        await api.admin.updateUser(TOKEN, id, { is_active: true });
        loadUsers();
        loadStats();
    } catch (err) { console.error(err); }
}

// ==========================================
// Orders Management
// ==========================================
let orderSearchTimer;
function debounceOrderSearch() {
    clearTimeout(orderSearchTimer);
    orderSearchTimer = setTimeout(() => loadOrders(1), 400);
}

let currentOrders = [];

async function loadOrders(page = 1) {
    const search = document.getElementById('orderSearch').value;
    const statusFilter = document.getElementById('orderStatusFilter').value;

    try {
        const data = await api.admin.getOrders(TOKEN, page, search, statusFilter);
        currentOrders = data.results || [];
        renderOrdersTable(currentOrders);
        renderPagination('ordersPagination', data, loadOrders);
    } catch (err) {
        console.error('Failed to load orders:', err);
    }
}

function getOrderStatusBadge(status) {
    const labels = {
        PENDING: 'معلق', ACCEPTED: 'مقبول', PREPARING: 'قيد التحضير',
        ON_DELIVERY: 'في التوصيل', DELIVERED: 'تم التوصيل', CANCELLED: 'ملغي'
    };
    return `<span class="badge-order ${status.toLowerCase()}">${labels[status] || status}</span>`;
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!orders.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-receipt"></i>لا يوجد طلبات مطابقة</div></td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const date = new Date(o.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const customerName = o.customer_details?.name || o.customer_details?.phone || '—';
        const shopName = o.shop_details?.name || '—';
        const driverName = o.driver_details?.name || o.driver_details?.phone || 'لم يُعيَّن';

        return `
            <tr>
                <td>#${o.id}</td>
                <td>${customerName}</td>
                <td>${shopName}</td>
                <td>${driverName}</td>
                <td>${parseFloat(o.total_price).toFixed(2)} ج.م</td>
                <td>${getOrderStatusBadge(o.status)}</td>
                <td>${date}</td>
                <td>
                    <button class="btn-action unblock" onclick="viewOrderDetails(${o.id})"><i class="bi bi-info-circle"></i> تفاصيل</button>
                </td>
            </tr>
        `;
    }).join('');
}

function viewOrderDetails(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) return;

    const modalBody = document.getElementById('orderModalBody');
    
    // Build Items HTML
    let itemsHtml = order.items.map(item => `
        <div class="d-flex justify-content-between border-bottom border-secondary py-2">
            <div>
                <strong>${item.product_details?.name || 'منتج'}</strong>
                <div class="text-muted small">الكمية: ${item.quantity}</div>
            </div>
            <div class="fw-bold">${parseFloat(item.price).toFixed(2)} ج.م</div>
        </div>
    `).join('');

    modalBody.innerHTML = `
        <div class="row g-3">
            <div class="col-md-6">
                <div class="p-3 rounded" style="background: rgba(255,255,255,0.05);">
                    <h6 class="text-marigold mb-3"><i class="bi bi-person"></i> بيانات العميل</h6>
                    <p class="mb-1"><strong>الاسم:</strong> ${order.customer_details?.name || '—'}</p>
                    <p class="mb-1"><strong>الهاتف:</strong> <span dir="ltr">${order.customer_details?.phone}</span></p>
                    <p class="mb-1"><strong>العنوان:</strong> ${order.delivery_location}</p>
                </div>
            </div>
            <div class="col-md-6">
                <div class="p-3 rounded" style="background: rgba(255,255,255,0.05);">
                    <h6 class="text-marigold mb-3"><i class="bi bi-shop"></i> المحل والطيار</h6>
                    <p class="mb-1"><strong>المحل:</strong> ${order.shop_details?.name || '—'}</p>
                    <p class="mb-1"><strong>هاتف المحل:</strong> <span dir="ltr">${order.shop_details?.phone || order.shop_details?.owner_phone || '—'}</span></p>
                    <p class="mb-1"><strong>الطيار:</strong> ${order.driver_details?.name || 'لم يُعيّن'}</p>
                    <p class="mb-1"><strong>هاتف الطيار:</strong> <span dir="ltr">${order.driver_details?.phone || '—'}</span></p>
                </div>
            </div>
            
            <div class="col-12 mt-4">
                <h6 class="text-marigold mb-3"><i class="bi bi-box"></i> محتويات الطلب</h6>
                ${itemsHtml}
                <div class="d-flex justify-content-between mt-3 pt-3 border-top border-secondary">
                    <h5 class="mb-0">الإجمالي:</h5>
                    <h5 class="text-success mb-0">${parseFloat(order.total_price).toFixed(2)} ج.م</h5>
                </div>
            </div>

            ${order.dispute_status !== 'NONE' ? `
            <div class="col-12 mt-3">
                <div class="alert alert-warning mb-0 py-2">
                    <strong>تنبيه مشكلة:</strong> ${order.dispute_reason || '—'}
                </div>
            </div>` : ''}
        </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
    modal.show();
}

// ==========================================
// Reports Management
// ==========================================
let reportSearchTimer;
function debounceReportSearch() {
    clearTimeout(reportSearchTimer);
    reportSearchTimer = setTimeout(() => loadReports(1), 400);
}

async function loadReports(page = 1) {
    const search = document.getElementById('reportSearch').value;
    const resolved = document.getElementById('reportResolvedFilter').value;

    try {
        const data = await api.admin.getReports(TOKEN, page, search, resolved);
        renderReportsTable(data.results || []);
        renderPagination('reportsPagination', data, loadReports);
    } catch (err) {
        console.error('Failed to load reports:', err);
    }
}

function renderReportsTable(reports) {
    const tbody = document.getElementById('reportsTableBody');
    if (!reports.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-flag"></i>لا يوجد تقارير</div></td></tr>`;
        return;
    }

    tbody.innerHTML = reports.map(r => {
        const date = new Date(r.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
        const statusBadge = r.is_resolved
            ? '<span class="badge-status resolved">تم الحل</span>'
            : '<span class="badge-status unresolved">مفتوح</span>';

        const action = !r.is_resolved
            ? `<button class="btn-action resolve" onclick="resolveReport(${r.id})"><i class="bi bi-check-circle"></i> حل</button>`
            : '—';

        return `
            <tr>
                <td>#${r.id}</td>
                <td>${r.user_name || r.user_phone || '—'}</td>
                <td>${r.subject}</td>
                <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.description}</td>
                <td>${statusBadge}</td>
                <td>${date}</td>
                <td>${action}</td>
            </tr>
        `;
    }).join('');
}

async function resolveReport(id) {
    try {
        await api.admin.updateReport(TOKEN, id, { is_resolved: true });
        loadReports();
        loadStats();
    } catch (err) { console.error(err); }
}

// ==========================================
// Pagination Renderer (Reusable)
// ==========================================
function renderPagination(containerId, data, loadFunction) {
    const container = document.getElementById(containerId);
    if (!data.count || data.count <= 15) {
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(data.count / 15);
    const currentPage = data.next
        ? parseInt(new URL(data.next).searchParams.get('page')) - 1
        : (data.previous ? parseInt(new URL(data.previous).searchParams.get('page') || 1) + 1 : 1);

    let html = '';
    html += `<button onclick="(${loadFunction.name})(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>
        <i class="bi bi-chevron-right"></i> السابق
    </button>`;
    html += `<span class="page-info">صفحة ${currentPage} من ${totalPages}</span>`;
    html += `<button onclick="(${loadFunction.name})(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>
        التالي <i class="bi bi-chevron-left"></i>
    </button>`;

    container.innerHTML = html;
}

// ==========================================
// Logout
// ==========================================
function adminLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    window.location.href = '/html/auth/login.html';
}

// ==========================================
// Init
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const name = localStorage.getItem('user_name') || 'أدمن';
    document.getElementById('welcomeText').textContent = `مرحباً، ${name}`;
    loadStats();
});
