import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, setAccessToken } from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  register: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Skip auth check on public pages (share links)
    const isPublicPage = window.location.pathname.startsWith('/share/');
    
    if (isPublicPage) {
      console.log('[Auth] Public page detected, skipping auth');
      setIsLoading(false);
      return;
    }

    // Only try to refresh token for protected pages
    (async () => {
      try {
        console.log('[Auth] Checking session...');
        const res = await api.post("/api/auth/refresh");
        if (isMounted) {
          console.log('[Auth] Session restored');
          setAccessToken(res.data.accessToken);
          setUser(res.data.user);
        }
      } catch (error) {
        if (isMounted) {
          console.log('[Auth] No session, user not logged in');
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await api.post("/api/auth/register", { email, password, name });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
    console.log('[Auth] Login successful');
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}