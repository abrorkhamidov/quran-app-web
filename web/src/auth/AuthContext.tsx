import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import api, { setAccessToken, storeRefresh, getStoredRefresh } from '../lib/api';

export type User = { id: string; email: string; name: string };

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  function applySession(data: { user: User; accessToken: string; refreshToken: string }) {
    setAccessToken(data.accessToken);
    storeRefresh(data.refreshToken);
    setUser(data.user);
  }

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    applySession(data);
  }

  async function register(email: string, password: string, name: string) {
    const { data } = await api.post('/auth/register', { email, password, name });
    applySession(data);
  }

  function logout() {
    setAccessToken(null);
    storeRefresh(null);
    setUser(null);
  }

  useEffect(() => {
    const refreshToken = getStoredRefresh();
    if (!refreshToken) { setLoading(false); return; }
    api
      .post('/auth/refresh', { refreshToken })
      .then(async ({ data }) => {
        setAccessToken(data.accessToken);
        storeRefresh(data.refreshToken);
        const me = await api.get('/auth/me');
        setUser(me.data);
      })
      .catch(() => { storeRefresh(null); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
