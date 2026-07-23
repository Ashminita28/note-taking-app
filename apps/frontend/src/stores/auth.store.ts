import { create } from 'zustand';
import type { UserProfile } from '@note-app/shared';

interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: UserProfile) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
  setUser: (user) => set({ user }),
  clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
  isAuthenticated: () => get().accessToken !== null,
}));
