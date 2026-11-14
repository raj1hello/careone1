import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const TOKEN_STORAGE_KEY = 'careone_auth_tokens';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function getStoredTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: StoredTokens | null) {
  if (!tokens) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = getStoredTokens();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function flushQueue(err: unknown, token: string | null) {
  for (const p of pendingQueue) {
    if (err || !token) {
      p.reject(err);
    } else {
      p.resolve(token);
    }
  }
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const tokens = getStoredTokens();
      if (!tokens?.refreshToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (newToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: tokens.refreshToken,
        });
        const newTokens: StoredTokens = {
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
        };
        setStoredTokens(newTokens);
        flushQueue(null, newTokens.accessToken);
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        flushQueue(refreshErr, null);
        setStoredTokens(null);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(err: unknown, fallback = 'Request failed'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
