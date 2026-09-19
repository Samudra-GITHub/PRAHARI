// GET / PATCH / DELETE /api/inspections/[id]

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, notFound, forbidden } from '@/lib/http';
import { UpdateInspectionBody } from '@/lib/validators';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import type { Prisma } from '@/generated/prisma/client';

type Ctx = { params: Promise<{ id: string }> };

async function loadInspection(id: string) {
  return db.inspection.findUnique({
    where: { id },
    include: { mine: { select: { id: true, name: true, code: true } }, inspector: { select: { id: true, name: true, email: true } } },
  });
}

function isAccessible(role: string, userId: string, mineId: string | null, inspectorId: string): boolean {
  if (role === 'CORPORATE_ADMIN' || role === 'REGULATOR') return true;
  if (role === 'MINE_OFFICIAL') return mineId === mineId; // same mine — compare to user.mineId at call site
  if (role === 'FIELD_INSPECTOR') return inspectorId === userId;
  return false;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const insp = await loadInspection(id);
  if (!insp) return notFound('Inspection not found');
  if (me.role === 'MINE_OFFICIAL' && insp.mineId !== me.mineId) return forbidden('You can only access inspections on your own mine');
  if (me.role === 'FIELD_INSPECTOR' && insp.inspectorId !== me.id) return forbidden('You can only access inspections you performed');
  return ok(insp);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const existing = await db.inspection.findUnique({ where: { id } });
  if (!existing) return notFound('Inspection not found');
  if (me.role === 'MINE_OFFICIAL' && existing.mineId !== me.mineId) return forbidden('You can only modify inspections on your own mine');
  if (me.role === 'FIELD_INSPECTOR' && existing.inspectorId !== me.id) return forbidden('You can only modify inspections you performed');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = UpdateInspectionBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid inspection payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  const data: Prisma.InspectionUpdateInput = {};
  if (parsed.data.mineId && parsed.data.mineId !== existing.mineId) {
    const m = await db.mine.findUnique({ where: { id: parsed.data.mineId } });
    if (!m) return bad('Referenced mineId does not exist', 'VALIDATION_ERROR');
    data.mine = { connect: { id: parsed.data.mineId } };
  }
  if (parsed.data.inspectorId && parsed.data.inspectorId !== existing.inspectorId) {
    const u = await db.user.findUnique({ where: { id: parsed.data.inspectorId } });
    if (!u) return bad('Referenced inspectorId does not exist', 'VALIDATION_ERROR');
    data.inspector = { connect: { id: parsed.data.inspectorId } };
  }
  if (parsed.data.type) data.type = parsed.data.type;
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.scheduledDate) data.scheduledDate = new Date(parsed.data.scheduledDate);
  if (parsed.data.completedDate !== undefined) data.completedDate = parsed.data.completedDate ? new Date(parsed.data.completedDate) : null;
  if (parsed.data.summary !== undefined) data.summary = parsed.data.summary ?? null;
  if (parsed.data.findings !== undefined) data.findings = (parsed.data.findings ?? null) as Prisma.InputJsonValue;
  if (parsed.data.riskScore !== undefined) data.riskScore = parsed.data.riskScore ?? null;
  if (parsed.data.riskReasons !== undefined) data.riskReasons = parsed.data.riskReasons;

  const updated = await db.inspection.update({ where: { id }, data, include: { mine: { select: { id: true, name: true, code: true } }, inspector: { select: { id: true, name: true, email: true } } } });
  await audit({ actorId: me.id, action: 'INSPECTION_UPDATE', resource: 'Inspection', resourceId: id, payload: parsed.data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const existing = await db.inspection.findUnique({ where: { id } });
  if (!existing) return notFound('Inspection not found');
  await db.inspection.delete({ where: { id } });
  await audit({ actorId: me.id, action: 'INSPECTION_DELETE', resource: 'Inspection', resourceId: id });
  return ok({ id });
}

// Suppress "unused" lint for the helper — kept for clarity of the
// access-control matrix above.
export const _isAccessible = isAccessible;
