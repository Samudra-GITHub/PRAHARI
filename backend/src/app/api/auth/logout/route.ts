// POST /api/auth/logout
// Revokes the refresh token (cookie or body) and clears the cookie.

import type { NextRequest } from 'next/server';
import { noContent, bad } from '@/lib/http';
import { revokeRefreshToken } from '@/lib/auth/tokens';
import { clearRefreshCookie, getRefreshCookie } from '@/lib/auth/cookies';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { sha256 } from '@/lib/auth/tokens';

export async function POST(req: NextRequest) {
  const raw = getRefreshCookie(req);
  if (!raw) {
    // Allow callers to pass the token in the body as well.
    try {
      const body = await req.json() as { refreshToken?: string };
      if (body?.refreshToken) {
        await revokeRefreshToken(body.refreshToken);
        // Try to find the user for audit logging.
        const record = await db.refreshToken.findUnique({ where: { tokenHash: sha256(body.refreshToken) } });
        if (record) {
          await audit({ actorId: record.userId, action: 'USER_LOGOUT', resource: 'User', resourceId: record.userId });
        }
        const res = noContent();
        clearRefreshCookie(res);
        return res;
      }
    } catch {
      // ignore parse errors
    }
    // No token at all — still return 204 for idempotency.
    const res = noContent();
    clearRefreshCookie(res);
    return res;
  }
  await revokeRefreshToken(raw);
  const record = await db.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (record) {
    await audit({ actorId: record.userId, action: 'USER_LOGOUT', resource: 'User', resourceId: record.userId });
  }
  const res = noContent();
  clearRefreshCookie(res);
  return res;
}

export async function GET() {
  return bad('Use POST /api/auth/logout to revoke a session.', 'METHOD_NOT_ALLOWED', undefined, 405);
}
