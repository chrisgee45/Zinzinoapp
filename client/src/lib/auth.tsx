import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "./api";
import type { Partner } from "@shared/schema";

type SessionPartner = Omit<Partner, "password">;

interface AuthValue {
  partner: SessionPartner | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; slug: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [partner, setPartner] = useState<SessionPartner | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setPartner(null);
      setLoading(false);
      return;
    }
    try {
      // /me slides the token expiry on every boot. The server returns
      // a freshly-signed 365d token alongside the partner payload — we
      // swap the stored one so an active partner is effectively
      // signed-in forever (this is what fixes the iPhone re-login at
      // the old 30d mark).
      const data = await api<{ token?: string; partner: SessionPartner }>("/api/auth/me");
      if (data.token) setToken(data.token);
      setPartner(data.partner);
    } catch {
      setToken(null);
      setPartner(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; partner: SessionPartner }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setPartner(data.partner);
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; password: string; slug: string }) => {
      const data = await api<{ token: string; partner: SessionPartner }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setToken(data.token);
      setPartner(data.partner);
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setPartner(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ partner, loading, login, register, logout, refresh }),
    [partner, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
