"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { api, setToken, clearToken, isLoggedIn } from "@/lib/api";

interface User {
  id: string;
  email: string;
  plan_id: string;
  created_at: string;
}

interface Subscription {
  status: string;
  current_period_end: string | null;
  daily_download_count: number;
}

interface AuthState {
  user: User | null;
  subscription: Subscription | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  subscription: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isLoggedIn()) {
      setUser(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      if (res.code === 0) {
        setUser(res.data.user);
        setSubscription(res.data.subscription);
      }
    } catch {
      clearToken();
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res.code !== 0) throw new Error(res.message);
    setToken(res.data.token);
    setUser(res.data.user);
    await refresh();
  };

  const register = async (email: string, password: string) => {
    const res = await api.register(email, password);
    if (res.code !== 0) throw new Error(res.message);
    setToken(res.data.token);
    setUser(res.data.user);
    await refresh();
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setSubscription(null);
  };

  return (
    <AuthContext.Provider value={{ user, subscription, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
