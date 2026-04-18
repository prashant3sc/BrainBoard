import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthActions {
  login(user: User, token: string): void;
  logout(): void;
  setUser(user: User): void;
  isLoggedIn(): boolean;
}

const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login(user, token) {
        localStorage.setItem('auth_token', token);
        set({ user, token });
      },

      logout() {
        localStorage.removeItem('auth_token');
        set({ user: null, token: null });
      },

      setUser(user) {
        set({ user });
      },

      isLoggedIn() {
        return get().user !== null;
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);

export default useAuthStore;
