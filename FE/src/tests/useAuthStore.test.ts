import { describe, it, expect, beforeEach } from 'vitest';
import useAuthStore from '@/store/useAuthStore';
import type { User } from '@/types';

const mockUser: User = {
  id: 'u1',
  name: 'Alice Admin',
  email: 'alice@example.com',
  role: 'admin',
};

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null });
  localStorage.clear();
});

describe('useAuthStore', () => {
  describe('initial state', () => {
    it('has null user and token', () => {
      const { user, token } = useAuthStore.getState();
      expect(user).toBeNull();
      expect(token).toBeNull();
    });

    it('isLoggedIn returns false when no user', () => {
      expect(useAuthStore.getState().isLoggedIn()).toBe(false);
    });
  });

  describe('login', () => {
    it('sets user and token', () => {
      useAuthStore.getState().login(mockUser, 'tok-abc');
      const { user, token } = useAuthStore.getState();
      expect(user).toEqual(mockUser);
      expect(token).toBe('tok-abc');
    });

    it('persists token in localStorage', () => {
      useAuthStore.getState().login(mockUser, 'tok-abc');
      expect(localStorage.getItem('auth_token')).toBe('tok-abc');
    });

    it('isLoggedIn returns true after login', () => {
      useAuthStore.getState().login(mockUser, 'tok-abc');
      expect(useAuthStore.getState().isLoggedIn()).toBe(true);
    });
  });

  describe('logout', () => {
    it('clears user and token', () => {
      useAuthStore.getState().login(mockUser, 'tok-abc');
      useAuthStore.getState().logout();
      const { user, token } = useAuthStore.getState();
      expect(user).toBeNull();
      expect(token).toBeNull();
    });

    it('removes auth_token from localStorage', () => {
      useAuthStore.getState().login(mockUser, 'tok-abc');
      useAuthStore.getState().logout();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('isLoggedIn returns false after logout', () => {
      useAuthStore.getState().login(mockUser, 'tok-abc');
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isLoggedIn()).toBe(false);
    });
  });

  describe('setUser', () => {
    it('updates the user without changing token', () => {
      useAuthStore.getState().login(mockUser, 'tok-abc');
      const updated: User = { ...mockUser, name: 'Alice Updated' };
      useAuthStore.getState().setUser(updated);
      expect(useAuthStore.getState().user?.name).toBe('Alice Updated');
      expect(useAuthStore.getState().token).toBe('tok-abc');
    });
  });
});
