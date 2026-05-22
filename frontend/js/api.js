const API_BASE = window.location.origin.includes('127.0.0.1') || window.location.origin.includes('localhost')
    ? (window.location.port === '8080' ? 'http://127.0.0.1:8000/api' : '/api')
    : '/api';

// ==========================================
// JWT Transparent Auto-Refresh Interceptor
// ==========================================
let refreshInProgressPromise = null;

async function getValidToken() {
    let access = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');
    
    if (!access) return null;
    
    // Check if access token is expired or expiring in less than 30 seconds
    let isExpired = true;
    try {
        const parts = access.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp > now + 30) {
                isExpired = false;
            }
        }
    } catch (e) {
        isExpired = true;
    }
    
    if (!isExpired) {
        return access;
    }
    
    if (!refresh) {
        // Clear and force logout if refresh token doesn't exist
        localStorage.clear();
        return null;
    }
    
    // Prevent simultaneous parallel refresh requests (thread safety)
    if (refreshInProgressPromise) {
        return await refreshInProgressPromise;
    }
    
    refreshInProgressPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh })
            });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('access_token', data.access);
                if (data.refresh) {
                    localStorage.setItem('refresh_token', data.refresh);
                }
                return data.access;
            } else {
                // Refresh token invalid or blacklisted, clear session and redirect
                localStorage.clear();
                window.location.href = '/html/auth/login.html';
                return null;
            }
        } catch (err) {
            console.error("Transparent token refresh failed:", err);
            return null;
        } finally {
            refreshInProgressPromise = null;
        }
    })();
    
    return await refreshInProgressPromise;
}

// Global fetch wrapper interceptor
const originalFetch = window.fetch;
window.fetch = async function (resource, config) {
    let newConfig = config ? { ...config } : {};
    
    let hasAuthHeader = false;
    let authHeaderValue = '';
    
    if (newConfig.headers) {
        if (newConfig.headers instanceof Headers) {
            if (newConfig.headers.has('Authorization')) {
                authHeaderValue = newConfig.headers.get('Authorization');
                hasAuthHeader = authHeaderValue.startsWith('Bearer ');
            }
        } else if (Array.isArray(newConfig.headers)) {
            const authItem = newConfig.headers.find(h => h[0].toLowerCase() === 'authorization');
            if (authItem) {
                authHeaderValue = authItem[1];
                hasAuthHeader = authHeaderValue.startsWith('Bearer ');
            }
        } else {
            const key = Object.keys(newConfig.headers).find(k => k.toLowerCase() === 'authorization');
            if (key) {
                authHeaderValue = newConfig.headers[key];
                hasAuthHeader = authHeaderValue.startsWith('Bearer ');
            }
        }
    }
    
    if (hasAuthHeader) {
        const validToken = await getValidToken();
        if (validToken) {
            if (newConfig.headers instanceof Headers) {
                newConfig.headers.set('Authorization', `Bearer ${validToken}`);
            } else if (Array.isArray(newConfig.headers)) {
                newConfig.headers = newConfig.headers.map(h => 
                    h[0].toLowerCase() === 'authorization' ? ['Authorization', `Bearer ${validToken}`] : h
                );
            } else {
                const key = Object.keys(newConfig.headers).find(k => k.toLowerCase() === 'authorization') || 'Authorization';
                newConfig.headers[key] = `Bearer ${validToken}`;
            }
        }
    }
    
    let response = await originalFetch(resource, newConfig);
    
    // Auto-retry once on 401 Unauthorized
    if (response.status === 401 && hasAuthHeader) {
        console.warn("401 Unauthorized detected. Attempting proactive session token refresh...");
        localStorage.removeItem('access_token');
        const refreshedToken = await getValidToken();
        if (refreshedToken) {
            if (newConfig.headers instanceof Headers) {
                newConfig.headers.set('Authorization', `Bearer ${refreshedToken}`);
            } else if (Array.isArray(newConfig.headers)) {
                newConfig.headers = newConfig.headers.map(h => 
                    h[0].toLowerCase() === 'authorization' ? ['Authorization', `Bearer ${refreshedToken}`] : h
                );
            } else {
                const key = Object.keys(newConfig.headers).find(k => k.toLowerCase() === 'authorization') || 'Authorization';
                newConfig.headers[key] = `Bearer ${refreshedToken}`;
            }
            response = await originalFetch(resource, newConfig);
        }
    }
    
    return response;
};

const api = {

    // ------------------------------------------ Authentication-related APIs ------------------------------------------

    auth: {
        login: async (phone, password) => {
            const res = await fetch(`${API_BASE}/auth/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        register: async (data) => {
            const res = await fetch(`${API_BASE}/auth/register/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        sendOtp: async (phone) => {
            const res = await fetch(`${API_BASE}/auth/send-otp/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        verifyOtp: async (phone, otp) => {
            const res = await fetch(`${API_BASE}/auth/verify-otp/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getProfile: async (token) => {
            const res = await fetch(`${API_BASE}/auth/profile/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) throw new Error('Unauthorized');
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        updateProfile: async (token, formData) => {
            const res = await fetch(`${API_BASE}/auth/profile/`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        requestPasswordReset: async (phone) => {
            const res = await fetch(`${API_BASE}/auth/password-reset/request/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        resetPassword: async (phone, otp, newPassword) => {
            const res = await fetch(`${API_BASE}/auth/password-reset/confirm/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp, new_password: newPassword })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        }
    },

    // ------------------------------------------ Shop-related APIs ------------------------------------------

    shops: {
        getAll: async (page = 1, search = '') => {
            const url = new URL(`${API_BASE}/shops/`, window.location.origin);
            if (page) url.searchParams.append('page', page);
            if (search) url.searchParams.append('search', search);
            
            const res = await fetch(url.toString());
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getById: async (id) => {
            const res = await fetch(`${API_BASE}/shops/${id}/`);
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getRatingStatus: async (token, id) => {
            const res = await fetch(`${API_BASE}/shops/${id}/rating_status/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        rateShop: async (token, id, rating, review = '') => {
            const res = await fetch(`${API_BASE}/shops/${id}/rate/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ rating, review })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getProducts: async (shopId) => {
            const res = await fetch(`${API_BASE}/products/?shop_id=${shopId}`);
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getMyShop: async (token) => {
            const res = await fetch(`${API_BASE}/shops/my_shop/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 404) return null;
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        createShop: async (token, formData) => {
            const res = await fetch(`${API_BASE}/shops/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        updateShop: async (token, shopId, formData) => {
            const res = await fetch(`${API_BASE}/shops/${shopId}/`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        addProduct: async (token, formData) => {
            const res = await fetch(`${API_BASE}/products/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        updateProduct: async (token, prodId, formData) => {
            const res = await fetch(`${API_BASE}/products/${prodId}/`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        deleteProduct: async (token, prodId) => {
            const res = await fetch(`${API_BASE}/products/${prodId}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return true;
        }
    },

    // ------------------------------------------ Category-related APIs -----------------------------------------

    categories: {
        getAll: async () => {
            const res = await fetch(`${API_BASE}/categories/`);
            if (!res.ok) throw await res.json();
            return await res.json();
        }
    },

    // ----------------------------------------- Order-related APIs -----------------------------------------


    orders: {
        getAll: async (token) => {
            const res = await fetch(`${API_BASE}/orders/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        create: async (token, data) => {
            const res = await fetch(`${API_BASE}/orders/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        updateStatus: async (token, orderId, status, extraData = {}) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/update_status/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status, ...extraData })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        acceptDelivery: async (token, orderId, deliveryPrice) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/accept_delivery/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ delivery_price: deliveryPrice })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        acceptCombinedDelivery: async (token, orderIds, deliveryPrice) => {
            const res = await fetch(`${API_BASE}/orders/accept_combined_delivery/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ order_ids: orderIds, delivery_price: deliveryPrice })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        postponeShopSettlement: async (token, orderId, shopId) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/postpone_shop_settlement/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ shop_id: shopId })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        confirmPaymentReceived: async (token, orderId, driverOtp) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/confirm_payment_received/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ driver_otp: driverOtp })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        raiseDispute: async (token, orderId, reason) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/raise_dispute/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        reportEmergency: async (token, orderId, reason) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/report_emergency/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        confirmEmergencyReturned: async (token, orderId) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/confirm_emergency_returned/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        toggleItemReady: async (token, orderId, itemId) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/toggle_item_ready/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ item_id: itemId })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getDriverRatingStatus: async (token, orderId) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/driver_rating_status/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        rateDriver: async (token, orderId, rating, review = '') => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/rate_driver/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ rating, review })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        }
    },

    // ------------------------------------------ Admin-related APIs ------------------------------------------

    admin: {
        getStats: async (token) => {
            const res = await fetch(`${API_BASE}/auth/admin/stats/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getUsers: async (token, page = 1, search = '', role = '', approved = '', active = '') => {
            const url = new URL(`${API_BASE}/auth/admin/users/`, window.location.origin);
            url.searchParams.append('page', page);
            if (search) url.searchParams.append('search', search);
            if (role) url.searchParams.append('role', role);
            if (approved) url.searchParams.append('approved', approved);
            if (active) url.searchParams.append('active', active);
            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        updateUser: async (token, userId, data) => {
            const res = await fetch(`${API_BASE}/auth/admin/users/${userId}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getOrders: async (token, page = 1, search = '', status = '') => {
            const url = new URL(`${API_BASE}/admin/orders/`, window.location.origin);
            url.searchParams.append('page', page);
            if (search) url.searchParams.append('search', search);
            if (status) url.searchParams.append('status', status);
            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getReports: async (token, page = 1, search = '', resolved = '') => {
            const url = new URL(`${API_BASE}/admin/reports/`, window.location.origin);
            url.searchParams.append('page', page);
            if (search) url.searchParams.append('search', search);
            if (resolved) url.searchParams.append('resolved', resolved);
            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        updateReport: async (token, reportId, data) => {
            const res = await fetch(`${API_BASE}/admin/reports/${reportId}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        }
    },

    // ----------------------------------------- Clinic-related APIs -----------------------------------------

    clinics: {
        getAll: async (page = 1, search = '', specialization = '') => {
            const url = new URL(`${API_BASE}/clinics/`, window.location.origin);
            if (page) url.searchParams.append('page', page);
            if (search) url.searchParams.append('search', search);
            if (specialization) url.searchParams.append('specialization', specialization);
            const res = await fetch(url.toString());
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getById: async (id) => {
            const res = await fetch(`${API_BASE}/clinics/${id}/`);
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getMyClinic: async (token) => {
            const res = await fetch(`${API_BASE}/clinics/my_clinic/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 404) return null;
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        createClinic: async (token, formData) => {
            const res = await fetch(`${API_BASE}/clinics/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        updateClinic: async (token, clinicId, formData) => {
            const res = await fetch(`${API_BASE}/clinics/${clinicId}/`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        toggleStatus: async (token, clinicId) => {
            const res = await fetch(`${API_BASE}/clinics/${clinicId}/toggle_status/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getAvailableSlots: async (clinicId, date, serviceId) => {
            let url = `${API_BASE}/clinics/${clinicId}/available_slots/?date=${date}`;
            if (serviceId) url += `&service_id=${serviceId}`;
            const res = await fetch(url);
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        generateSlots: async (token, clinicId, startDate, endDate) => {
            const res = await fetch(`${API_BASE}/clinics/${clinicId}/generate_slots/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ start_date: startDate, end_date: endDate })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        rateClinic: async (token, id, rating, review = '') => {
            const res = await fetch(`${API_BASE}/clinics/${id}/rate/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ rating, review })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getRatingStatus: async (token, id) => {
            const res = await fetch(`${API_BASE}/clinics/${id}/rating_status/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        }
    },

    // ------------------------------------------ Service-related APIs ------------------------------------------

    services: {
        getAll: async (clinicId) => {
            const res = await fetch(`${API_BASE}/services/?clinic_id=${clinicId}`);
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        create: async (token, formData) => {
            const res = await fetch(`${API_BASE}/services/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        update: async (token, serviceId, formData) => {
            const res = await fetch(`${API_BASE}/services/${serviceId}/`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        delete: async (token, serviceId) => {
            const res = await fetch(`${API_BASE}/services/${serviceId}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return true;
        }
    },
    appointments: {
        getAll: async (token) => {
            const res = await fetch(`${API_BASE}/appointments/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        create: async (token, data) => {
            const res = await fetch(`${API_BASE}/appointments/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        updateStatus: async (token, appointmentId, status) => {
            const res = await fetch(`${API_BASE}/appointments/${appointmentId}/update_status/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        }
    },
    clinicNotifications: {
        getAll: async (token) => {
            const res = await fetch(`${API_BASE}/clinic-notifications/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getUnreadCount: async (token) => {
            const notifications = await api.clinicNotifications.getAll(token);
            return notifications.filter(n => !n.is_read).length;
        },
        markRead: async (token, id) => {
            const res = await fetch(`${API_BASE}/clinic-notifications/${id}/mark_read/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        markAllRead: async (token) => {
            const res = await fetch(`${API_BASE}/clinic-notifications/mark_all_read/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        }
    },
    notifications: {
        getAll: async (token) => {
            const res = await fetch(`${API_BASE}/notifications/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getByRole: async (token, role) => {
            // The backend returns the logged-in user's own notifications.
            // Role is included here for frontend clarity and future role-specific behavior.
            return await api.notifications.getAll(token);
        },
        getUnreadCount: async (token) => {
            const notifications = await api.notifications.getAll(token);
            return notifications.filter(n => !n.is_read).length;
        },
        markRead: async (token, id) => {
            const res = await fetch(`${API_BASE}/notifications/${id}/mark_read/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        markAllRead: async (token) => {
            const res = await fetch(`${API_BASE}/notifications/mark_all_read/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        }
    }
};
