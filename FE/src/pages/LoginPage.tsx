import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/useAuthStore';
import { mockUsers } from '@/mocks/users';
import { apiClient } from '@/api/client';
import type { User } from '@/types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export function LoginPage() {
  const { login, isLoggedIn } = useAuthStore();
  const navigate = useNavigate();

  const [selectedUserId, setSelectedUserId] = useState(mockUsers[0].id);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  if (isLoggedIn()) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (USE_MOCK) {
        const user = mockUsers.find((u) => u.id === selectedUserId)!;
        login(user, 'mock-token');
      } else {
        const { data } = await apiClient.post<{ user: User; token: string }>('/auth/login', { email, password });
        login(data.user, data.token);
      }
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-indigo-600">Jira 2.0</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your workspace</p>
          {USE_MOCK && (
            <span className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-700">
              Hackathon Demo Mode
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {USE_MOCK ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Login as</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {mockUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="you@3sc.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
