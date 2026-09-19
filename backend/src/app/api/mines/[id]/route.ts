// GET / PATCH / DELETE /api/mines/[id]
//
// - GET     : FIELD_INSPECTOR / MINE_OFFICIAL / CORPORATE_ADMIN / REGULATOR
// - PATCH   : CORPORATE_ADMIN only
// - DELETE  : CORPORATE_ADMIN only
//
// MINE_OFFICIAL gets 403 if they try to read a mine that isn't theirs.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, notFound, forbidden } from '@/lib/http';
import { UpdateMineBody } from '@/lib/validators';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };

async function loadMineForCaller(req: NextRequest, id: string) {
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return { guard } as const;
  const me = (guard.req as MyRequest).user;
  const mine = await db.mine.findUnique({ where: { id } });
  if (!mine) return { guard, mine: null } as const;
  if (me.role === 'MINE_OFFICIAL' && mine.id !== me.mineId) {
    return { guard, mine, forbidden: true } as const;
  }
  return { guard, mine } as const;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await loadMineForCaller(req, id);
  if (!('guard' in result && result.guard)) {
    // Unreachable — `loadMineForCaller` always returns guard
    return notFound();
  }
  if (!result.guard.ok) return result.guard.response;
  if (!result.mine) return notFound('Mine not found');
  if ((result as { forbidden?: boolean }).forbidden) return forbidden('You can only access your own mine');
  return ok(result.mine);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;

  const existing = await db.mine.findUnique({ where: { id } });
  if (!existing) return notFound('Mine not found');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = UpdateMineBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid mine payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  if (parsed.data.code && parsed.data.code !== existing.code) {
    const clash = await db.mine.findUnique({ where: { code: parsed.data.code } });
    if (clash) return bad('A mine with that code already exists', 'CODE_CONFLICT', undefined, 409);
  }
  const updated = await db.mine.update({ where: { id }, data: parsed.data });
  await audit({ actorId: me.id, action: 'MINE_UPDATE', resource: 'Mine', resourceId: id, payload: parsed.data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const existing = await db.mine.findUnique({ where: { id } });
  if (!existing) return notFound('Mine not found');
  await db.mine.delete({ where: { id } });
  await audit({ actorId: me.id, action: 'MINE_DELETE', resource: 'Mine', resourceId: id });
  return ok({ id });
}
