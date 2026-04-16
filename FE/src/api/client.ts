import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  timeout: 10_000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Zustand persists {user, token} to localStorage via the 'auth-store' key.
    // After the 8-hour access-token expiry the user remains "logged in" locally
    // until the next API call returns 401.  We rely on this interceptor to clear
    // the stale token and redirect — no proactive /auth/me polling is needed.
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
