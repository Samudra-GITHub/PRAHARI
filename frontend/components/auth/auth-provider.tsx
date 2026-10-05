'use client';

// React context wiring on top of services/auth.service.ts + lib/auth.ts.
// Owns nothing about the auth flow itself — it just:
//   1. On mount, attempts to restore a session from the httpOnly refresh
//      cookie (POST /api/auth/refresh), then confirms identity via
//      GET /api/auth/me.
//   2. Subscribes to lib/auth.ts's session state so the React `user` value
//      stays correct even when the session changes from outside a direct
//      login()/logout() call (e.g. a background refresh failing inside
//      lib/api.ts after a 401).
//   3. Exposes `login`/`logout` that call straight into the auth service.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as authService from '@/services/auth.service';
import type { LoginBody } from '@/types/api';
import type { User } from '@/types/models';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: (body: LoginBody) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Keep `user` in sync with lib/auth.ts's module-level session state,
  // however it changes.
  useEffect(() => {
    return authService.subscribeToSession((session) => {
      setUser(session.user);
    });
  }, []);

  // Session restoration on app load: exchange the httpOnly refresh cookie
  // for a fresh access token, then confirm who it belongs to.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const restored = await authService.refreshAccessToken();
      if (cancelled) return;
      if (!restored) {
        setStatus('unauthenticated');
        return;
      }
      try {
        await authService.me();
        if (!cancelled) setStatus('authenticated');
      } catch {
        if (!cancelled) setStatus('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (body: LoginBody) => {
    await authService.login(body);
    await authService.me();
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setStatus('unauthenticated');
  }, []);

  return <AuthContext.Provider value={{ status, user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>');
  return ctx;
}
