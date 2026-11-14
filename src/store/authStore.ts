import { create } from 'zustand';
import { api, getStoredTokens, setStoredTokens } from '../services/api.ts';

export type UserRole = 'patient' | 'doctor' | 'hospital' | 'pharmacy' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  full_name: string;
  phone: string;
  is_verified: number;
}

interface AuthState {
  user: AuthUser | null;
  profile: Record<string, any> | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: Record<string, unknown>) => Promise<AuthUser>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isInitialized: false,
  isLoading: false,
  error: null,

  initAuth: async () => {
    const tokens = getStoredTokens();
    if (!tokens?.accessToken) {
      set({ user: null, profile: null, isInitialized: true });
      return;
    }
    try {
      const res = await api.get('/auth/me');
      set({
        user: res.data.user,
        profile: res.data.profile,
        isInitialized: true,
      });
    } catch {
      setStoredTokens(null);
      set({ user: null, profile: null, isInitialized: true });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      setStoredTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
      });
      set({
        user: res.data.user,
        profile: res.data.profile,
        isLoading: false,
        isInitialized: true,
      });
      return res.data.user as AuthUser;
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Invalid credentials.';
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  register: async (payload: Record<string, unknown>) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/register', payload);
      setStoredTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
      });
      set({
        user: res.data.user,
        profile: res.data.profile,
        isLoading: false,
        isInitialized: true,
      });
      return res.data.user as AuthUser;
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Registration failed.';
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  logout: async () => {
    const tokens = getStoredTokens();
    try {
      if (tokens?.refreshToken) {
        await api.post('/auth/logout', { refreshToken: tokens.refreshToken });
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      setStoredTokens(null);
      set({ user: null, profile: null, error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
