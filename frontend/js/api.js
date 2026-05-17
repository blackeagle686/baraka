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
        getAll: async () => {
            const res = await fetch(`${API_BASE}/shops/`);
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
        updateStatus: async (token, orderId, status) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/update_status/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
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
        confirmPaymentReceived: async (token, orderId) => {
            const res = await fetch(`${API_BASE}/orders/${orderId}/confirm_payment_received/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw await res.json();
            return await res.json();
        }
    }
};
