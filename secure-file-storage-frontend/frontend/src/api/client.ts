import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://secure-file-storage-6o08.onrender.com";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const isPublicEndpoint = config.url?.includes('/api/files/public/');
  const isRefreshEndpoint = config.url?.includes('/api/auth/refresh');
  
  if (accessToken && !isPublicEndpoint && !isRefreshEndpoint) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  
  return config;
});

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
    const isAuthRoute = original?.url?.includes("/api/auth/login") || 
                        original?.url?.includes("/api/auth/register");
    const isPublicEndpoint = original?.url?.includes('/api/files/public/');
    const isRefreshEndpoint = original?.url?.includes('/api/auth/refresh');

    if (isPublicEndpoint || isRefreshEndpoint || isAuthRoute) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && original && !original._retry) {
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
    const message = err.response?.data?.error?.message || err.response?.data?.message;
    if (typeof message === "string") return message;
  }
  return fallback;
}