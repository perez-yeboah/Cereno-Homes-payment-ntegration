import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api', // Proxied by Vite locally, uses env in prod
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (config.url?.startsWith('/admin')) {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
  } else {
    const clientToken = localStorage.getItem('clientToken');
    if (clientToken) {
      config.headers.Authorization = `Bearer ${clientToken}`;
    }
  }
  return config;
});

export const fetchClientLedger = async (planId: string) => {
  const response = await api.get(`/plans/${planId}/ledger`);
  return response.data;
};

export const initializePayment = async (data: any) => {
  const response = await api.post('/payments/initialize', data);
  return response.data;
};

export const fetchAdminBalances = async () => {
  const response = await api.get('/admin/balances');
  return response.data;
};

export const fetchOverdueInvoices = async () => {
  const response = await api.get('/admin/invoices/overdue');
  return response.data;
};

// Properties
export const fetchProperties = async () => {
  const response = await api.get('/properties');
  return response.data;
};

export const submitPropertyInterest = async (propertyId: string, clientId: string, submittedData: any) => {
  const response = await api.post(`/properties/${propertyId}/interest`, { clientId, submittedData });
  return response.data;
};

export const fetchProjectUpdates = async (propertyId: string) => {
  const response = await api.get(`/properties/${propertyId}/updates`);
  return response.data;
};

export const cancelClientApplication = async (id: string) => {
  const response = await api.patch(`/client/interests/${id}/cancel`);
  return response.data;
};

export const fetchClientPlans = async () => {
  const response = await api.get('/client/plans');
  return response.data;
};

// Admin New Features
export const fetchAdminProperties = async () => {
  const response = await api.get('/admin/properties');
  return response.data;
};

export const fetchLiveTransactions = async () => {
  const response = await api.get('/admin/transactions');
  return response.data;
};

export const createProperty = async (data: any) => {
  const isFormData = data instanceof FormData;
  const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;
  const response = await api.post('/properties', data, config);
  return response.data;
};

export const deleteProperty = async (id: string) => {
  const response = await api.delete(`/properties/${id}`);
  return response.data;
};

export const updateProperty = async (id: string, data: any) => {
  const isFormData = data instanceof FormData;
  const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;
  const response = await api.put(`/properties/${id}`, data, config);
  return response.data;
};

export const sendProjectUpdate = async (propertyId: string, data: { title: string; content: string }) => {
  const response = await api.post(`/properties/${propertyId}/updates`, data);
  return response.data;
};

export const fetchAdminApplications = async () => {
  const response = await api.get('/admin/interests');
  return response.data;
};

export const updateApplicationStatus = async (id: string, status: string) => {
  const response = await api.patch(`/admin/interests/${id}/status`, { status });
  return response.data;
};

export const verifyPayment = async (reference: string) => {
  const response = await api.post('/payments/verify', { reference });
  return response.data;
};

export default api;
