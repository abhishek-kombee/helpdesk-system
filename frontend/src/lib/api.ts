import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/api/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('access_token', access);
        originalRequest.headers.Authorization = `Bearer ${access}`;

        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  register: (data: { username: string; email: string; password: string; password_confirm: string; role: string }) =>
    api.post('/register/', data),
  login: (data: { email: string; password: string }) =>
    api.post('/login/', data),
  me: () => api.get('/me/'),
};

// Tickets API
export const ticketsAPI = {
  list: (params?: { page?: number; status?: string; priority?: string; assigned_to?: string }) =>
    api.get('/tickets/', { params }),
  get: (id: number) => api.get(`/tickets/${id}/`),
  create: (data: { title: string; description: string; priority: string; assigned_to_id?: number | null }) =>
    api.post('/tickets/', data),
  update: (id: number, data: Partial<{ title: string; description: string; status: string; priority: string; assigned_to_id: number | null }>) =>
    api.patch(`/tickets/${id}/`, data),
  delete: (id: number) => api.delete(`/tickets/${id}/`),
};

// Comments API
export const commentsAPI = {
  list: (ticketId: number) => api.get(`/tickets/${ticketId}/comments/`),
  create: (ticketId: number, data: { message: string }) =>
    api.post(`/tickets/${ticketId}/comments/`, data),
  delete: (ticketId: number, commentId: number) =>
    api.delete(`/tickets/${ticketId}/comments/${commentId}/`),
};

// Users API
export const usersAPI = {
  agents: () => api.get('/users/'),
};

// Health API
export const healthAPI = {
  check: () => axios.get(`${API_URL}/health/`),
};

// Prometheus query API (proxied through backend or direct)
export const prometheusAPI = {
  query: (query: string) =>
    axios.get(`http://localhost:9090/api/v1/query`, { params: { query } }),
};
