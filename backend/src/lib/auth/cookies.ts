// Small helpers to read/write the auth cookie on the request/response
// cycle. We use httpOnly + SameSite=Lax cookies for the refresh token,
// which prevents JS access and most CSRF vectors while still allowing the
// cookie to flow across login redirects.

import type { NextResponse } from 'next/server';

const REFRESH_COOKIE = 'rt';

export function setRefreshCookie(res: NextResponse, token: string, expiresAt: Date): void {
  res.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, path: '/api/auth', maxAge: 0 });
}

export function getRefreshCookie(req: Request): string | undefined {
  const ck = req.headers.get('cookie');
  if (!ck) return undefined;
  for (const part of ck.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === REFRESH_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
