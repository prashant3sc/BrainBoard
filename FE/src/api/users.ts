import { apiClient } from './client';
import type { User, Role } from '../types';
import { mockUsers } from '../mocks/users';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/* In-memory mutable copy for mock mode */
let _mockUsers: User[] = [...mockUsers];
let _nextId = mockUsers.length + 1;

export const usersApi = {
  getAll(): Promise<User[]> {
    if (USE_MOCK) return Promise.resolve([..._mockUsers]);
    return apiClient.get<User[]>('/users').then((r) => r.data);
  },

  updateRole(id: string, role: Role): Promise<User> {
    if (USE_MOCK) {
      const found = _mockUsers.find((u) => u.id === id);
      if (!found) return Promise.reject(new Error(`User ${id} not found`));
      found.role = role;
      return Promise.resolve({ ...found });
    }
    return apiClient.patch<User>(`/users/${id}`, { role }).then((r) => r.data);
  },

  createUser(data: { first_name: string; last_name: string; email: string; role: Role; password: string }): Promise<User> {
    if (USE_MOCK) {
      const newUser: User = { id: `user-${_nextId++}`, name: `${data.first_name} ${data.last_name}`, email: data.email, role: data.role };
      _mockUsers.push(newUser);
      return Promise.resolve({ ...newUser });
    }
    return apiClient.post<User>('/users/create', data).then((r) => r.data);
  },

  deleteUser(id: string): Promise<void> {
    if (USE_MOCK) {
      _mockUsers = _mockUsers.filter((u) => u.id !== id);
      return Promise.resolve();
    }
    return apiClient.delete(`/users/${id}`).then(() => undefined);
  },
};
