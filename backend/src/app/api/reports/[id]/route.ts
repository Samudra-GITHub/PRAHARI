// GET / PATCH / DELETE /api/reports/[id]
// PATCH supports status transitions: DRAFT→SUBMITTED→APPROVED or DRAFT→SUBMITTED→REJECTED.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, notFound, forbidden } from '@/lib/http';
import { UpdateReportBody } from '@/lib/validators';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import type { Prisma } from '@/generated/prisma/client';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const report = await db.report.findUnique({
    where: { id },
    include: { mine: { select: { id: true, name: true, code: true } }, author: { select: { id: true, name: true, email: true } } },
  });
  if (!report) return notFound('Report not found');
  if (me.role === 'MINE_OFFICIAL' && report.mineId !== me.mineId) return forbidden('You can only access reports on your own mine');
  return ok(report);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['MINE_OFFICIAL', 'CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const existing = await db.report.findUnique({ where: { id } });
  if (!existing) return notFound('Report not found');
  if (me.role === 'MINE_OFFICIAL' && existing.mineId !== me.mineId) return forbidden('You can only modify reports on your own mine');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = UpdateReportBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid report payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  // Only CORPORATE_ADMIN can APPROVE/REJECT.
  if ((parsed.data.status === 'APPROVED' || parsed.data.status === 'REJECTED') && me.role !== 'CORPORATE_ADMIN') {
    return bad('Only CORPORATE_ADMIN can approve or reject reports', 'FORBIDDEN', undefined, 403);
  }
  // SUBMITTED is the only valid transition out of DRAFT by non-admins.
  if (parsed.data.status === 'SUBMITTED' && existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
    return bad(`Cannot submit a report in status ${existing.status}`, 'INVALID_TRANSITION', undefined, 409);
  }
  if (parsed.data.status === 'APPROVED' && existing.status !== 'SUBMITTED') {
    return bad('Can only approve SUBMITTED reports', 'INVALID_TRANSITION', undefined, 409);
  }
  if (parsed.data.status === 'REJECTED' && existing.status !== 'SUBMITTED') {
    return bad('Can only reject SUBMITTED reports', 'INVALID_TRANSITION', undefined, 409);
  }

  const data: Prisma.ReportUpdateInput = {};
  if (parsed.data.type) data.type = parsed.data.type;
  if (parsed.data.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === 'SUBMITTED' && !existing.submittedAt) data.submittedAt = new Date();
    if (parsed.data.status === 'APPROVED') data.approvedAt = new Date();
  }
  if (parsed.data.title) data.title = parsed.data.title;
  if (parsed.data.body) data.body = parsed.data.body;
  if (parsed.data.periodStart) data.periodStart = new Date(parsed.data.periodStart);
  if (parsed.data.periodEnd) data.periodEnd = new Date(parsed.data.periodEnd);

  const updated = await db.report.update({
    where: { id },
    data,
    include: { mine: { select: { id: true, name: true, code: true } }, author: { select: { id: true, name: true, email: true } } },
  });
  await audit({ actorId: me.id, action: 'REPORT_UPDATE', resource: 'Report', resourceId: id, payload: parsed.data });
  return ok(updated);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const existing = await db.report.findUnique({ where: { id } });
  if (!existing) return notFound('Report not found');
  await db.report.delete({ where: { id } });
  await audit({ actorId: me.id, action: 'REPORT_DELETE', resource: 'Report', resourceId: id });
  return ok({ id });
}
