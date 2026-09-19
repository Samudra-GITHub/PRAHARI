// POST /api/auth/refresh
// Reads the refresh token from the httpOnly cookie OR the request body,
// rotates it, returns a new access token, and sets the new cookie.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad } from '@/lib/http';
import { signAccessToken, rotateRefreshToken } from '@/lib/auth/tokens';
import { setRefreshCookie, getRefreshCookie } from '@/lib/auth/cookies';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  let raw = getRefreshCookie(req);
  if (!raw) {
    let body: { refreshToken?: string } | undefined;
    try {
      body = await req.json();
    } catch {
      // Body is optional; ignore parse errors.
    }
    raw = body?.refreshToken;
  }
  if (!raw) {
    return bad('No refresh token provided', 'NO_REFRESH_TOKEN', undefined, 401);
  }
  const rotated = await rotateRefreshToken(raw);
  if (!rotated) {
    return bad('Refresh token is invalid, revoked, or expired', 'INVALID_REFRESH_TOKEN', undefined, 401);
  }
  const user = await db.user.findUnique({ where: { id: rotated.userId } });
  if (!user || !user.active) {
    return bad('User not found or deactivated', 'INVALID_USER', undefined, 401);
  }
  const accessToken = await signAccessToken({ userId: user.id, role: user.role, email: user.email });
  await audit({ actorId: user.id, action: 'TOKEN_REFRESH', resource: 'User', resourceId: user.id });

  const res = ok({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mineId: user.mineId,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
  setRefreshCookie(res, rotated.token, rotated.expiresAt);
  return res;
}
