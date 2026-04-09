'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  setTokens: (access: string, refresh: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await fetch('https://veramed.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Login failed');
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
          const meRes = await fetch('https://veramed.onrender.com/api/auth/me', {
            headers: { Authorization: 'Bearer ' + data.accessToken },
          });
          const me = await meRes.json();
          set({ user: me, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },
      logout: async () => {
        const { refreshToken } = get();
        try {
          await fetch('https://veramed.onrender.com/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + get().accessToken },
            body: JSON.stringify({ refreshToken }),
          });
        } finally {
          set({ user: null, accessToken: null, refreshToken: null });
        }
      },
      setUser: (user) => set({ user }),
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
    }),
    {
      name: 'veramed-auth',
      partialize: (state) => ({ user: state.user, refreshToken: state.refreshToken }),
    },
  ),
);
