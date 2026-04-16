import { apiClient } from './client';
import type { User, Role } from '../types';
import { mockUsers } from '../mocks/users';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const usersApi = {
  getAll(): Promise<User[]> {
    if (USE_MOCK) return Promise.resolve(mockUsers);
    return apiClient.get<User[]>('/users').then((r) => r.data);
  },

  updateRole(id: string, role: Role): Promise<User> {
    if (USE_MOCK) {
      const found = mockUsers.find((u) => u.id === id);
      if (!found) return Promise.reject(new Error(`User ${id} not found`));
      return Promise.resolve({ ...found, role });
    }
    return apiClient.patch<User>(`/users/${id}`, { role }).then((r) => r.data);
  },
};
