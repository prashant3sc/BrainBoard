import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRBAC } from '@/hooks/useRBAC';
import useAuthStore from '@/store/useAuthStore';
import type { User } from '@/types';

function makeUser(role: User['role']): User {
  return { id: 'u1', name: 'Test User', email: 'test@example.com', role };
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null });
});

describe('useRBAC', () => {
  describe('when not logged in', () => {
    it('role is null', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.role).toBeNull();
    });

    it('can() returns false for any permission', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('createProject')).toBe(false);
      expect(result.current.can('manageUsers')).toBe(false);
    });

    it('isAdmin() returns false', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.isAdmin()).toBe(false);
    });

    it('isPM() returns false', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.isPM()).toBe(false);
    });
  });

  describe('admin role', () => {
    beforeEach(() => useAuthStore.setState({ user: makeUser('admin'), token: 'tok' }));

    it('isAdmin() returns true', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.isAdmin()).toBe(true);
    });

    it('can manageUsers', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('manageUsers')).toBe(true);
    });

    it('can createProject', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('createProject')).toBe(true);
    });

    it('can deleteIssue', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('deleteIssue')).toBe(true);
    });
  });

  describe('pm role', () => {
    beforeEach(() => useAuthStore.setState({ user: makeUser('pm'), token: 'tok' }));

    it('isPM() returns true', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.isPM()).toBe(true);
    });

    it('can createProject', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('createProject')).toBe(true);
    });

    it('cannot manageUsers', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('manageUsers')).toBe(false);
    });

    it('can deleteIssue', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('deleteIssue')).toBe(true);
    });
  });

  describe('developer role', () => {
    beforeEach(() => useAuthStore.setState({ user: makeUser('developer'), token: 'tok' }));

    it('cannot createProject', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('createProject')).toBe(false);
    });

    it('cannot manageUsers', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('manageUsers')).toBe(false);
    });

    it('can editIssue', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('editIssue')).toBe(true);
    });

    it('cannot deleteIssue', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('deleteIssue')).toBe(false);
    });

    it('can createWikiPage', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('createWikiPage')).toBe(true);
    });
  });

  describe('viewer role', () => {
    beforeEach(() => useAuthStore.setState({ user: makeUser('viewer'), token: 'tok' }));

    it('cannot perform any write action', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('createProject')).toBe(false);
      expect(result.current.can('editIssue')).toBe(false);
      expect(result.current.can('deleteIssue')).toBe(false);
      expect(result.current.can('manageUsers')).toBe(false);
      expect(result.current.can('createWikiPage')).toBe(false);
    });

    it('can() returns false for unknown permission', () => {
      const { result } = renderHook(() => useRBAC());
      expect(result.current.can('nonExistentPermission')).toBe(false);
    });
  });
});
