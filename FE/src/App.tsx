import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// TODO: uncomment after `npx shadcn@latest add toast`
// import { Toaster } from '@/components/ui/toaster';

import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import useAppStore from '@/store/useAppStore';
import useAuthStore from '@/store/useAuthStore';
import { authApi } from '@/api/auth';

/* Syncs the Zustand theme state → <html class="dark"> */
function ThemeSync() {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/* Refreshes user data from /auth/me on app startup when a token exists */
function AuthSync() {
  const token   = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (USE_MOCK || !token) return;
    authApi.me().then(setUser).catch(() => {/* 401 is handled by axios interceptor */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

const LoginPage             = React.lazy(() => import('@/pages/LoginPage'));
const DashboardPage         = React.lazy(() => import('@/pages/DashboardPage'));
const BacklogPage           = React.lazy(() => import('@/pages/BacklogPage'));
const KanbanPage            = React.lazy(() => import('@/pages/KanbanPage'));
const WikiPage              = React.lazy(() => import('@/pages/WikiPage'));
const UserManagementPage    = React.lazy(() => import('@/pages/UserManagementPage'));
const ProjectSettingsPage   = React.lazy(() => import('@/pages/ProjectSettingsPage'));
const AnalyticsPage         = React.lazy(() => import('@/pages/AnalyticsPage'));
const IssuePage             = React.lazy(() => import('@/pages/IssuePage'));
const AiSyncPage            = React.lazy(() => import('@/pages/AiSyncPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,               // always consider data stale → refetch on every mount
      refetchOnMount: true,       // re-fetch whenever a component mounts (page navigation)
      refetchOnWindowFocus: false, // don't refetch on tab switch
      retry: 1,                    // only retry failed requests once
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <AuthSync />
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

            <Route
              path="/projects/:projectId/issues/:ticketId"
              element={
                <ProtectedRoute>
                  <IssuePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/projects/:projectId/analytics"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AnalyticsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/ai-sync"
              element={
                <ProtectedRoute permission="manageUsers">
                  <AppShell>
                    <AiSyncPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/projects/:projectId/settings"
              element={
                <ProtectedRoute permission="manageProjectMembers">
                  <AppShell>
                    <ProjectSettingsPage />
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
