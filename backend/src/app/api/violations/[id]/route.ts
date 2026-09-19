// GET / PATCH / DELETE /api/violations/[id]
// PATCH supports escalation: status='ESCALATED' bumps `escalationCount` and
// sets `escalatedAt`. The repeated-violations workflow trigger creates an
// alert when 3+ violations are recorded on a mine in a 90-day window.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, notFound, forbidden } from '@/lib/http';
import { UpdateViolationBody } from '@/lib/validators';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import type { Prisma } from '@/generated/prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const v = await db.violation.findUnique({
    where: { id },
    include: {
      mine: { select: { id: true, name: true, code: true } },
      inspection: { select: { id: true, scheduledDate: true, status: true } },
      issuedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!v) return notFound('Violation not found');
  if (me.role === 'MINE_OFFICIAL' && v.mineId !== me.mineId) return forbidden('You can only access violations on your own mine');
  return ok(v);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const existing = await db.violation.findUnique({ where: { id } });
  if (!existing) return notFound('Violation not found');
  if (me.role === 'MINE_OFFICIAL' && existing.mineId !== me.mineId) return forbidden('You can only modify violations on your own mine');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = UpdateViolationBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid violation payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  const data: Prisma.ViolationUpdateInput = {};
  if (parsed.data.severity) data.severity = parsed.data.severity;
  if (parsed.data.code) data.code = parsed.data.code;
  if (parsed.data.description) data.description = parsed.data.description;
  if (parsed.data.penaltyAmount !== undefined) data.penaltyAmount = parsed.data.penaltyAmount;
  if (parsed.data.inspectionId !== undefined) {
    data.inspection = parsed.data.inspectionId ? { connect: { id: parsed.data.inspectionId } } : { disconnect: true };
  }
  if (parsed.data.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === 'ESCALATED') {
      data.escalatedAt = new Date();
      data.escalationCount = { increment: 1 };
    }
    if (parsed.data.status === 'RECTIFIED') {
      data.rectifiedAt = new Date();
    }
  }

  const updated = await db.violation.update({
    where: { id },
    data,
    include: {
      mine: { select: { id: true, name: true, code: true } },
      inspection: { select: { id: true, scheduledDate: true, status: true } },
      issuedBy: { select: { id: true, name: true, email: true } },
    },
  });
  await audit({ actorId: me.id, action: 'VIOLATION_UPDATE', resource: 'Violation', resourceId: id, payload: parsed.data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const existing = await db.violation.findUnique({ where: { id } });
  if (!existing) return notFound('Violation not found');
  await db.violation.delete({ where: { id } });
  await audit({ actorId: me.id, action: 'VIOLATION_DELETE', resource: 'Violation', resourceId: id });
  return ok({ id });
}
