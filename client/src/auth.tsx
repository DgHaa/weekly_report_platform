import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from './api';

interface AuthCtx {
  user: any;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('wr_user') || 'null'); } catch { return null; }
  });

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    localStorage.setItem('wr_token', res.token);
    localStorage.setItem('wr_user', JSON.stringify(res.user));
    setUser(res.user);
  };
  const logout = () => {
    localStorage.removeItem('wr_token');
    localStorage.removeItem('wr_user');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('auth context missing');
  return c;
}
