import axios from 'axios';
import useAuthStore from '@/store/useAuthStore';

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
    // On 401 we must clear the full Zustand auth store (not just auth_token), otherwise
    // the persisted `user` object keeps isLoggedIn() returning true and LoginPage
    // immediately redirects back to /dashboard — causing an infinite loop.
    if (error.response?.status === 401) {
      // Only clear session + redirect if we're not already on the login page
      // and not currently in the middle of a login request itself.
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        useAuthStore.getState().logout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);
