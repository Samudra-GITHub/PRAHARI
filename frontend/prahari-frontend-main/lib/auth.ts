// Session/token state for the backend's JWT + rotating-refresh-token auth
// flow (backend/src/lib/auth/tokens.ts, backend/src/lib/auth/cookies.ts).
//
// How the backend's flow works, and how this module maps onto it:
//  - POST /api/auth/login returns { accessToken, user } and sets an httpOnly,
//    path-scoped ("/api/auth") refresh-token cookie named `rt`. JS can never
//    read that cookie — the browser just resends it automatically to any
//    /api/auth/* request when `credentials: 'include'` is used.
//  - The access token is a short-lived (15m default) JWT that must be sent
//    as `Authorization: Bearer <token>` on every other request. It has to be
//    readable by JS to do that, so it is kept in memory only (never
//    localStorage/sessionStorage) — this avoids persisting a bearer token in
//    web storage, at the cost of losing it on a full page reload.
//  - On a full reload (memory cleared), `refreshAccessToken()` exchanges the
//    still-valid httpOnly cookie for a new access token via
//    POST /api/auth/refresh. Call this once during app bootstrap.
//  - lib/api.ts also calls `refreshAccessToken()` automatically whenever a
//    request comes back 401, and retries that request once.
//
// This module exposes plain functions (no React dependency itself) plus a
// tiny subscribe/emit mechanism so the AuthProvider (components/auth/) can
// stay in sync when the session changes from *outside* a direct user
// action — e.g. lib/api.ts silently clearing the session after a background
// refresh failure.

import { API_BASE_URL } from './config';
import type { ApiResult, AuthResponse } from '@/types/api';
import type { User } from '@/types/models';

let accessToken: string | null = null;
let currentUser: User | null = null;

// Coalesces concurrent refresh attempts into a single in-flight request so
// e.g. five simultaneous 401s don't fire five refresh calls.
let refreshInFlight: Promise<AuthResponse | null> | null = null;

export type SessionState = { accessToken: string | null; user: User | null };
type Listener = (state: SessionState) => void;
const listeners = new Set<Listener>();

function snapshot(): SessionState {
  return { accessToken, user: currentUser };
}

// Notifies subscribers of the current session state. Call immediately with
// the current snapshot (so a component mounting after the state settled
// still gets it), and returns an unsubscribe function.
export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  const state = snapshot();
  for (const listener of listeners) listener(state);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function isAuthenticated(): boolean {
  return accessToken !== null;
}

export function setSession(session: AuthResponse): void {
  accessToken = session.accessToken;
  currentUser = session.user;
  emit();
}

// Also accepts just the user (used after GET /api/auth/me, which doesn't
// return a token) without touching the access token.
export function setCurrentUser(user: User): void {
  currentUser = user;
  emit();
}

export function clearSession(): void {
  accessToken = null;
  currentUser = null;
  emit();
}

// Calls POST /api/auth/refresh directly (not through lib/api.ts's apiFetch)
// to avoid recursing back into the 401-retry logic that calls this
// function. Relies on the httpOnly `rt` cookie via `credentials: 'include'`.
export async function refreshAccessToken(): Promise<AuthResponse | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as ApiResult<AuthResponse>;
      if (!res.ok || !json.ok) {
        clearSession();
        return null;
      }
      setSession(json.data);
      return json.data;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
