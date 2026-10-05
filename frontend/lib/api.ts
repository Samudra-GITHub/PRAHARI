// Core HTTP client for the PRAHARI Mining Compliance Management backend.
//
// Every backend route responds with the envelope defined in
// backend/src/lib/http.ts:
//   Success: { ok: true,  data: T }
//   Failure: { ok: false, error: { code, message, details? } }
//
// This module unwraps that envelope, attaches the JWT access token to
// authenticated requests, and transparently refreshes the access token via
// POST /api/auth/refresh (backend/src/app/api/auth/refresh/route.ts) on a
// 401, retrying the original request exactly once.

import { getAccessToken, refreshAccessToken, clearSession } from './auth';
import { API_BASE_URL } from './config';
import type { ApiErr, ApiResult } from '@/types/api';

export { API_BASE_URL };

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  // Set to false only for the handful of routes that don't require a JWT
  // (POST /api/auth/login, /api/auth/register is CORPORATE_ADMIN-gated so it
  // stays true, /api/auth/refresh, /api/auth/logout, /api/workflow/run).
  // Defaults to true.
  auth?: boolean;
  signal?: AbortSignal;
  // Extra headers, e.g. the `x-cron-secret` header POST /api/workflow/run
  // requires (backend/src/app/api/workflow/run/route.ts).
  headers?: Record<string, string>;
};

// Builds a query string from a flat params object, skipping
// undefined/null values. Matches the query params every list endpoint
// accepts (backend/src/lib/pagination.ts `parseListQuery`).
export function buildQueryString(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  // 204 No Content (DELETE /api/mines/{id}, POST /api/auth/logout) has no body.
  if (res.status === 204) return undefined as T;

  let json: ApiResult<T> | undefined;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch {
    throw new ApiError('Response was not valid JSON', 'INVALID_RESPONSE', res.status);
  }

  if (json.ok) return json.data;

  const err = (json as ApiErr).error;
  throw new ApiError(err?.message ?? 'Request failed', err?.code ?? 'UNKNOWN_ERROR', res.status, err?.details);
}

async function doFetch(path: string, options: RequestOptions): Promise<Response> {
  const url = `${API_BASE_URL}${path}${buildQueryString(options.query)}`;
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    // Needed so the httpOnly refresh-token cookie (path=/api/auth, see
    // backend/src/lib/auth/cookies.ts) is sent on auth routes.
    credentials: 'include',
    signal: options.signal,
  });
}

// Core request function used by every service module. Unwraps the
// { ok, data } / { ok, error } envelope and retries once after a silent
// token refresh on 401.
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isRefreshCall = path === '/api/auth/refresh';
  let res = await doFetch(path, options);

  if (res.status === 401 && options.auth !== false && !isRefreshCall) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch(path, options);
    } else {
      clearSession();
    }
  }

  return parseEnvelope<T>(res);
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
