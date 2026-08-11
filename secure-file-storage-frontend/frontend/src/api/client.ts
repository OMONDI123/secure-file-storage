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
  if (token) {
    console.log('[API] Access token set');
  } else {
    console.log('[API] Access token cleared');
  }
}

export function getAccessToken() {
  return accessToken;
}

// Request interceptor
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const isPublicEndpoint = config.url?.includes('/api/files/public/');
  const isRefreshEndpoint = config.url?.includes('/api/auth/refresh');
  const isAuthEndpoint = config.url?.includes('/api/auth/login') || 
                         config.url?.includes('/api/auth/register');
  
  // Debug logging
  console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
  console.log(`[API] Public: ${isPublicEndpoint}, Auth: ${isAuthEndpoint}, Refresh: ${isRefreshEndpoint}`);
  console.log(`[API] Has token: ${!!accessToken}`);

  // Only add auth header for protected endpoints when we have a token
  if (accessToken && !isPublicEndpoint && !isRefreshEndpoint && !isAuthEndpoint) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
    console.log('[API] Added auth header');
  } else if (isPublicEndpoint) {
    console.log('[API] Public endpoint - no auth header');
  }

  return config;
});

// Refresh token management
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    console.log('[API] Attempting to refresh token...');
    refreshPromise = api
      .post("/api/auth/refresh")
      .then((res) => {
        const token = res.data.accessToken as string;
        setAccessToken(token);
        console.log('[API] Token refreshed successfully');
        return token;
      })
      .catch((error) => {
        console.log('[API] Refresh failed:', error.response?.status);
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Response interceptor
api.interceptors.response.use(
  (res) => {
    console.log(`[API] Response: ${res.status} ${res.config.url}`);
    return res;
  },
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    
    // Don't retry for these endpoints
    const isPublicEndpoint = original?.url?.includes('/api/files/public/');
    const isAuthEndpoint = original?.url?.includes('/api/auth/login') || 
                           original?.url?.includes('/api/auth/register');
    const isRefreshEndpoint = original?.url?.includes('/api/auth/refresh');

    console.log(`[API] Error: ${error.response?.status} for ${original?.url}`);

    if (isPublicEndpoint || isAuthEndpoint || isRefreshEndpoint) {
      return Promise.reject(error);
    }

    // Handle 401 by refreshing token
    if (error.response?.status === 401 && original && !original._retry) {
      console.log('[API] 401 received, attempting refresh...');
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        console.log('[API] Retrying with new token...');
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api(original);
      } else {
        console.log('[API] Refresh failed, redirecting to login...');
        // Redirect to login if refresh fails
        window.location.href = '/login';
        return Promise.reject(error);
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