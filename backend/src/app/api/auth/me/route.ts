// GET /api/auth/me
// Returns the currently authenticated user record.

import type { NextRequest } from 'next/server';
import { ok } from '@/lib/http';
import { requireRole, type MyRequest } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const user = (guard.req as MyRequest).user;
  return ok({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mineId: user.mineId,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}
