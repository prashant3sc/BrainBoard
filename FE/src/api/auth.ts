import { apiClient } from './client';
import type { User } from '../types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const authApi = {
  login(email: string, password: string): Promise<{ user: User; token: string }> {
    if (USE_MOCK) return Promise.reject(new Error('Use mock login directly'));
    return apiClient
      .post<{ user: User; token: string }>('/auth/login', { email, password })
      .then((r) => r.data);
  },

  logout(): Promise<void> {
    if (USE_MOCK) return Promise.resolve();
    return apiClient.post('/auth/logout').then(() => undefined);
  },

  me(): Promise<User> {
    if (USE_MOCK) return Promise.reject(new Error('Use mock data directly'));
    return apiClient.get<User>('/auth/me').then((r) => r.data);
  },
};
