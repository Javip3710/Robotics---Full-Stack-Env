import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, getToken, setToken } from "../api/client";
import { authApi } from "../api/endpoints";
import type { CurrentUser } from "../api/types";

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<CurrentUser>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await authApi.me();
        if (!cancelled) setUser(me);
      } catch (err) {
        // Stale/invalid token — clear it.
        if (err instanceof ApiError && err.status === 401) setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await authApi.login({ email, password });
    setToken(token);
    setUser(u);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    return authApi.register({ name, email, password });
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
