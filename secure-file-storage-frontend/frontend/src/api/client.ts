import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://secure-file-storage-6o08.onrender.com";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send the httpOnly refresh-token cookie
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Skip adding auth header for public endpoints
  const isPublicEndpoint = config.url?.includes('/api/files/public/');
  
  // Only add auth token if:
  // 1. We have a token AND
  // 2. It's NOT a public endpoint
  if (accessToken && !isPublicEndpoint) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  
  return config;
});

// Queue concurrent requests while a single refresh call is in flight,
// so a burst of 401s doesn't trigger a burst of refresh calls.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/api/auth/refresh")
      .then((res) => {
        const token = res.data.accessToken as string;
        setAccessToken(token);
        return token;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthRoute = original?.url?.includes("/api/auth/login") || original?.url?.includes("/api/auth/register");
    const isPublicEndpoint = original?.url?.includes('/api/files/public/');

    // Skip refresh logic for public endpoints
    if (isPublicEndpoint) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.error?.message;
    if (typeof message === "string") return message;
  }
  return fallback;
}