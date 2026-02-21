import axios from 'axios';

// Use relative URL to work with Flask server
// The Flask server will serve this frontend from /trading-journal
const API_BASE_URL = '/api/trading-journal';

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Important: Send session cookies
});

// Response interceptor - Handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Not authenticated - redirect to main login
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Accounts API
export const accountsAPI = {
    getAll: () => api.get('/accounts'),
    getById: (id) => api.get(`/accounts/${id}`),
    getStats: (id) => api.get(`/accounts/${id}/stats`),
    update: (id, data) => api.put(`/accounts/${id}`, data),
};

// Trades API
export const tradesAPI = {
    getAll: (params) => api.get('/trades', { params }),
    getById: (id) => api.get(`/trades/${id}`),
    create: (data) => api.post('/trades', data),
    update: (id, data) => api.put(`/trades/${id}`, data),
    delete: (id) => api.delete(`/trades/${id}`),
    bulkDelete: (ids) => api.post('/trades/bulk-delete', { ids }),
    sync: (accountNumber, trades) => api.post('/trades/sync', { accountNumber, trades }),
};

// Analytics API
export const analyticsAPI = {
    getSummary: (accountId) => api.get('/analytics/summary', { params: { account_id: accountId } }),
    getByPair: (accountId) => api.get('/analytics/by-pair', { params: { account_id: accountId } }),
    getByDate: (accountId, days) => api.get('/analytics/by-date', { params: { account_id: accountId, days } }),
    getPerformance: (accountId) => api.get('/analytics/performance', { params: { account_id: accountId } }),
};

// Settings API
export const settingsAPI = {
    get: () => api.get('/settings'),
    update: (data) => api.put('/settings', data),
    getColumns: () => api.get('/settings/columns'),
    createColumn: (data) => api.post('/settings/columns', data),
    updateColumn: (id, data) => api.put(`/settings/columns/${id}`, data),
    deleteColumn: (id) => api.delete(`/settings/columns/${id}`),
};

export default api;
