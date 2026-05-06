import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import useAuthStore from '@/store/useAuthStore';
import type { User } from '@/types';

const adminUser: User = { id: 'u1', name: 'Admin', email: 'a@x.com', role: 'admin' };
const viewerUser: User = { id: 'u2', name: 'Viewer', email: 'v@x.com', role: 'viewer' };

function renderWithRouter(
  ui: React.ReactNode,
  { initialPath = '/' }: { initialPath?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null });
});

describe('ProtectedRoute', () => {
  describe('when not logged in', () => {
    it('redirects to /login', () => {
      renderWithRouter(
        <ProtectedRoute>
          <div>Secret Content</div>
        </ProtectedRoute>,
      );
      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Secret Content')).toBeNull();
    });
  });

  describe('when logged in without permission requirement', () => {
    it('renders children', () => {
      useAuthStore.setState({ user: adminUser, token: 'tok' });
      renderWithRouter(
        <ProtectedRoute>
          <div>Secret Content</div>
        </ProtectedRoute>,
      );
      expect(screen.getByText('Secret Content')).toBeInTheDocument();
    });
  });

  describe('when logged in with matching permission', () => {
    it('renders children for admin with manageUsers permission', () => {
      useAuthStore.setState({ user: adminUser, token: 'tok' });
      renderWithRouter(
        <ProtectedRoute permission="manageUsers">
          <div>Admin Area</div>
        </ProtectedRoute>,
      );
      expect(screen.getByText('Admin Area')).toBeInTheDocument();
    });
  });

  describe('when logged in but missing permission', () => {
    it('redirects to /dashboard for viewer trying to access manageUsers', () => {
      useAuthStore.setState({ user: viewerUser, token: 'tok' });
      renderWithRouter(
        <ProtectedRoute permission="manageUsers">
          <div>Admin Area</div>
        </ProtectedRoute>,
      );
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      expect(screen.queryByText('Admin Area')).toBeNull();
    });

    it('redirects developer trying to access createProject', () => {
      useAuthStore.setState({
        user: { ...adminUser, role: 'developer' },
        token: 'tok',
      });
      renderWithRouter(
        <ProtectedRoute permission="manageUsers">
          <div>Restricted</div>
        </ProtectedRoute>,
      );
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });
  });
});
