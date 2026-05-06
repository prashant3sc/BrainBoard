import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';

// Must be declared before any imports that trigger axios.create
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof axios>();

  const mockInstance = {
    interceptors: {
      request:  { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => mockInstance),
    },
  };
});

// Import after vi.mock so the mock is in place
import { apiClient } from '@/api/client';
import useAuthStore from '@/store/useAuthStore';
import type { User } from '@/types';

const mockUser: User = { id: 'u1', name: 'Test', email: 't@x.com', role: 'admin' };

// Pull the registered interceptor functions once (module is loaded once)
function getRequestFn() {
  const requestUse = apiClient.interceptors.request.use as ReturnType<typeof vi.fn>;
  return requestUse.mock.calls[0]?.[0] as ((c: { headers: Record<string, string> }) => { headers: Record<string, string> }) | undefined;
}

function getErrorFn() {
  const responseUse = apiClient.interceptors.response.use as ReturnType<typeof vi.fn>;
  return responseUse.mock.calls[0]?.[1] as ((e: unknown) => Promise<never>) | undefined;
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null });
  localStorage.clear();
});

describe('apiClient', () => {
  describe('request interceptor', () => {
    it('attaches Authorization header when auth_token is in localStorage', () => {
      localStorage.setItem('auth_token', 'tok-xyz');
      const requestFn = getRequestFn();
      const config = { headers: {} as Record<string, string> };
      const result = requestFn!(config);
      expect(result.headers.Authorization).toBe('Bearer tok-xyz');
    });

    it('does not attach Authorization header when no token in localStorage', () => {
      const requestFn = getRequestFn();
      const config = { headers: {} as Record<string, string> };
      const result = requestFn!(config);
      expect(result.headers['Authorization']).toBeUndefined();
    });
  });

  describe('response interceptor — 401 handling', () => {
    it('calls logout and redirects to /login on 401 for non-login request', async () => {
      useAuthStore.setState({ user: mockUser, token: 'tok' });
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '/dashboard', pathname: '/dashboard' },
      });

      const errorFn = getErrorFn();
      const err = { response: { status: 401 }, config: { url: '/api/issues' } };
      await errorFn!(err).catch(() => {});

      // Verify logout was executed (user is cleared)
      expect(useAuthStore.getState().user).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('does NOT logout on 401 from the login endpoint itself', async () => {
      useAuthStore.setState({ user: mockUser, token: 'tok' });

      const errorFn = getErrorFn();
      const err = { response: { status: 401 }, config: { url: '/auth/login' } };
      await errorFn!(err).catch(() => {});

      // User should still be set — logout was NOT called
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('propagates non-401 errors without logging out', async () => {
      useAuthStore.setState({ user: mockUser, token: 'tok' });

      const errorFn = getErrorFn();
      const err = { response: { status: 500 }, config: { url: '/api/issues' } };
      await errorFn!(err).catch(() => {});

      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('rejects the promise so callers can still handle the error', async () => {
      const errorFn = getErrorFn();
      const err = { response: { status: 404 }, config: { url: '/api/issues' } };
      await expect(errorFn!(err)).rejects.toBeDefined();
    });
  });
});
