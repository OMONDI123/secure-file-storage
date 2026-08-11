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
    let timeoutId: ReturnType<typeof setTimeout>; // ✅ Fixed type

    // Set a timeout to prevent infinite loading
    timeoutId = setTimeout(() => {
      if (isMounted && isLoading) {
        console.log('[Auth] Refresh timeout - continuing without auth');
        setIsLoading(false);
      }
    }, 5000);

    (async () => {
      try {
        console.log('[Auth] Attempting to refresh token...');
        const res = await api.post("/api/auth/refresh");
        if (isMounted) {
          setAccessToken(res.data.accessToken);
          setUser(res.data.user);
          console.log('[Auth] Token refreshed successfully');
        }
      } catch (error) {
        if (isMounted) {
          console.log('[Auth] No valid session, user not logged in');
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          clearTimeout(timeoutId);
        }
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await api.post("/api/auth/register", { email, password, name });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
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