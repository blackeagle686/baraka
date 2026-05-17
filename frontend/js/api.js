const API_BASE = 'http://127.0.0.1:8000/api';

const api = {
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
        }
    },
    shops: {
        getAll: async (page = 1, search = '') => {
            const url = new URL(`${API_BASE}/shops/`);
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
        }
    },
    admin: {
        getStats: async (token) => {
            const res = await fetch(`${API_BASE}/auth/admin/stats/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        },
        getUsers: async (token, page = 1, search = '', role = '', approved = '', active = '') => {
            const url = new URL(`${API_BASE}/auth/admin/users/`);
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
            const url = new URL(`${API_BASE}/admin/orders/`);
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
            const url = new URL(`${API_BASE}/admin/reports/`);
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
    }
};
