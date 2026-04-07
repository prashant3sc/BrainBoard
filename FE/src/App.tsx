import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';

const LoginPage          = React.lazy(() => import('@/pages/LoginPage'));
const DashboardPage      = React.lazy(() => import('@/pages/DashboardPage'));
const KanbanPage         = React.lazy(() => import('@/pages/KanbanPage'));
const WikiPage           = React.lazy(() => import('@/pages/WikiPage'));
const UserManagementPage = React.lazy(() => import('@/pages/UserManagementPage'));

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-gray-400">Loading…</div>}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Protected */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/projects/:projectId/kanban"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <KanbanPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/projects/:projectId/wiki"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <WikiPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/users"
              element={
                <ProtectedRoute permission="manageUsers">
                  <AppShell>
                    <UserManagementPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
