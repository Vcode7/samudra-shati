import { create } from 'zustand';

type AuthorityUser = {
  id?: number;
  organization_name?: string;
  authority_type?: string;
};

type AuthState = {
  token: string | null;
  user: AuthorityUser | null;
  setAuth: (token: string, user?: AuthorityUser | null) => void;
  clear: () => void;
  hydrate: () => void;
};

const STORAGE_KEY = 'authority_jwt';

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  setAuth: (token, user) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, token);
    }
    set({ token, user: user ?? null });
  },
  clear: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ token: null, user: null });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && !get().token) {
      set({ token: stored });
    }
  },
}));
