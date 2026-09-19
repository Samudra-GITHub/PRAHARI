// GET / PATCH / DELETE /api/alerts/[id]

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, notFound, forbidden } from '@/lib/http';
import { UpdateAlertBody } from '@/lib/validators';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import type { Prisma } from '@/generated/prisma/client';

type Ctx = { params: Promise<{ id: string }> };

async function loadAlert(id: string) {
  return db.alert.findUnique({
    where: { id },
    include: {
      mine: { select: { id: true, name: true, code: true } },
      inspection: { select: { id: true, scheduledDate: true, status: true } },
      violation: { select: { id: true, code: true, severity: true } },
      report: { select: { id: true, title: true, type: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      acknowledgedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const alert = await loadAlert(id);
  if (!alert) return notFound('Alert not found');
  if (me.role === 'MINE_OFFICIAL' && alert.mineId !== me.mineId) return forbidden('You can only access alerts on your own mine');
  return ok(alert);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const existing = await db.alert.findUnique({ where: { id } });
  if (!existing) return notFound('Alert not found');
  if (me.role === 'MINE_OFFICIAL' && existing.mineId !== me.mineId) return forbidden('You can only modify alerts on your own mine');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = UpdateAlertBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid alert payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  const data: Prisma.AlertUpdateInput = {};
  if (parsed.data.type) data.type = parsed.data.type;
  if (parsed.data.severity) data.severity = parsed.data.severity;
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.title) data.title = parsed.data.title;
  if (parsed.data.message) data.message = parsed.data.message;
  if (parsed.data.dueDate !== undefined) data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (parsed.data.triggerData !== undefined) data.triggerData = (parsed.data.triggerData ?? null) as Prisma.InputJsonValue;
  if (parsed.data.assignedToId !== undefined) {
    data.assignedTo = parsed.data.assignedToId ? { connect: { id: parsed.data.assignedToId } } : { disconnect: true };
  }
  // When transitioning to ACKNOWLEDGED, set acknowledgedById and acknowledgedAt
  // if not already set.
  if (parsed.data.status === 'ACKNOWLEDGED' && !existing.acknowledgedById) {
    data.acknowledgedBy = { connect: { id: me.id } };
    data.acknowledgedAt = new Date();
  }
  if (parsed.data.status === 'RESOLVED' && !existing.resolvedAt) {
    data.resolvedAt = new Date();
  }

  const updated = await db.alert.update({ where: { id }, data, include: {
    mine: { select: { id: true, name: true, code: true } },
    inspection: { select: { id: true, scheduledDate: true, status: true } },
    violation: { select: { id: true, code: true, severity: true } },
    report: { select: { id: true, title: true, type: true } },
    assignedTo: { select: { id: true, name: true, email: true } },
    acknowledgedBy: { select: { id: true, name: true, email: true } },
  } });
  await audit({ actorId: me.id, action: 'ALERT_UPDATE', resource: 'Alert', resourceId: id, payload: parsed.data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const existing = await db.alert.findUnique({ where: { id } });
  if (!existing) return notFound('Alert not found');
  await db.alert.delete({ where: { id } });
  await audit({ actorId: me.id, action: 'ALERT_DELETE', resource: 'Alert', resourceId: id });
  return ok({ id });
}
