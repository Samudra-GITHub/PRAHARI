// POST /api/auth/login
// Returns: { accessToken, user } and sets the httpOnly refresh-token cookie.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad } from '@/lib/http';
import { LoginBody } from '@/lib/validators';
import { verifyPassword } from '@/lib/auth/password';
import { signAccessToken, issueRefreshToken } from '@/lib/auth/tokens';
import { setRefreshCookie } from '@/lib/auth/cookies';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = LoginBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid login payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) {
    return bad('Invalid email or password', 'INVALID_CREDENTIALS', undefined, 401);
  }
  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    return bad('Invalid email or password', 'INVALID_CREDENTIALS', undefined, 401);
  }
  const accessToken = await signAccessToken({ userId: user.id, role: user.role, email: user.email });
  const refresh = await issueRefreshToken(user.id);
  await audit({ actorId: user.id, action: 'USER_LOGIN', resource: 'User', resourceId: user.id, payload: { email } });

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
  setRefreshCookie(res, refresh.token, refresh.expiresAt);
  return res;
}
