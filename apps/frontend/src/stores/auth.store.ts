import { create } from 'zustand';

// `user`'s real type (`User` from `@note-app/shared`) lands with AB-1002 — `auth.types.ts` is a
// stub until then, so this store holds it as `unknown` rather than hand-defining the shape here.
interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  user: unknown | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: unknown) => void;
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
