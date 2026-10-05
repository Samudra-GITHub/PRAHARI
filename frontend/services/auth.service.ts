// backend/src/app/api/auth/** — login, registration, session refresh/logout.

import { api } from '@/lib/api';
import {
  setSession,
  setCurrentUser,
  clearSession,
  refreshAccessToken,
  getCurrentUser,
  isAuthenticated,
  subscribeToSession,
} from '@/lib/auth';
import type { AuthResponse, LoginBody, RegisterBody } from '@/types/api';
import type { User } from '@/types/models';

// POST /api/auth/login — no auth required. Stores the returned access
// token/user in memory (lib/auth.ts) on success.
export async function login(body: LoginBody): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>('/api/auth/login', body, { auth: false });
  setSession(data);
  return data;
}

// POST /api/auth/register — CORPORATE_ADMIN only.
export async function register(body: RegisterBody): Promise<User> {
  return api.post<User>('/api/auth/register', body);
}

// POST /api/auth/logout — revokes the refresh token and clears the cookie.
// Always clears local session state, even if the network call fails.
export async function logout(): Promise<void> {
  try {
    await api.post<void>('/api/auth/logout', undefined, { auth: false });
  } finally {
    clearSession();
  }
}

// GET /api/auth/me — returns the currently authenticated user. Also updates
// the in-memory session's user record (e.g. after a token refresh that only
// tells us the token is valid, this confirms *who* it belongs to).
export async function me(): Promise<User> {
  const user = await api.get<User>('/api/auth/me');
  setCurrentUser(user);
  return user;
}

// Re-exported for convenience so callers only need to import from
// services/auth.service.ts for everything auth-related.
export { refreshAccessToken, getCurrentUser, isAuthenticated, subscribeToSession };
