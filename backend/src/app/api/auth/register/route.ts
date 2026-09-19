// POST /api/auth/register
// CORPORATE_ADMIN only. Creates a new user. The body can optionally
// specify `role` and `mineId` (for MINE_OFFICIAL).

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, conflict } from '@/lib/http';
import { RegisterBody } from '@/lib/validators';
import { hashPassword } from '@/lib/auth/password';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = RegisterBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid registration payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  const { email, password, name, role, mineId } = parsed.data;

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return conflict('A user with that email already exists');

  // If role is MINE_OFFICIAL, mineId must be supplied and must exist.
  if (role === 'MINE_OFFICIAL' && !mineId) {
    return bad('MINE_OFFICIAL users must have a mineId', 'VALIDATION_ERROR');
  }
  if (mineId) {
    const mine = await db.mine.findUnique({ where: { id: mineId } });
    if (!mine) return bad('Referenced mineId does not exist', 'VALIDATION_ERROR');
  }

  const passwordHash = await hashPassword(password);
  const created = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash,
      role: role ?? 'FIELD_INSPECTOR',
      mineId: mineId ?? null,
    },
  });

  await audit({ actorId: me.id, action: 'USER_REGISTER', resource: 'User', resourceId: created.id, payload: { email, role: created.role, mineId: created.mineId } });

  return ok({
    id: created.id,
    email: created.email,
    name: created.name,
    role: created.role,
    mineId: created.mineId,
    active: created.active,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  }, 201);
}
