import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// TODO: uncomment after `npx shadcn@latest add toast`
// import { Toaster } from '@/components/ui/toaster';

import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import useAppStore from '@/store/useAppStore';

/* Syncs the Zustand theme state → <html class="dark"> */
function ThemeSync() {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

const LoginPage          = React.lazy(() => import('@/pages/LoginPage'));
const DashboardPage      = React.lazy(() => import('@/pages/DashboardPage'));
const BacklogPage        = React.lazy(() => import('@/pages/BacklogPage'));
const KanbanPage         = React.lazy(() => import('@/pages/KanbanPage'));
const WikiPage           = React.lazy(() => import('@/pages/WikiPage'));
const UserManagementPage = React.lazy(() => import('@/pages/UserManagementPage'));

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      {/* <Toaster /> */}
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
              path="/projects/:projectId/backlog"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <BacklogPage />
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
