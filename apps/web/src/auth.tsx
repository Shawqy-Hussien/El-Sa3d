import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ApiUser } from './api.js';
import { api } from './api.js';

interface AuthContextValue {
  user: ApiUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('namaa-user') ?? 'null') as ApiUser | null;
    } catch {
      return null;
    }
  });

  const value = useMemo<AuthContextValue>(() => ({
    user,
    async signIn(email, password) {
      const result = await api.login(email, password);
      setUser(result.user);
      localStorage.setItem('namaa-user', JSON.stringify(result.user));
    },
    async signOut() {
      await api.logout();
      setUser(null);
      localStorage.removeItem('namaa-user');
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
