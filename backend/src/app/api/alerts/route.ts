// GET / POST /api/alerts
//
// A first-class `Alert` resource matching the frontend contract.
// Role scoping:
//   - FIELD_INSPECTOR  : all alerts (they need visibility on the mines they inspect)
//   - MINE_OFFICIAL    : alerts on their own mine only
//   - CORPORATE_ADMIN  : all alerts
//   - REGULATOR        : all alerts (read-only)
//
// Query params:
//   - mineId   — filter by mine
//   - status   — filter by alert status
//   - severity — filter by severity
//   - type     — filter by alert type
//   - page, pageSize

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad } from '@/lib/http';
import { CreateAlertBody } from '@/lib/validators';
import { requireRole, type MyRequest, mineScopeFilter } from '@/lib/rbac';
import { parseListQuery, parseSort, paginate } from '@/lib/pagination';
import { audit } from '@/lib/audit';
import type { Prisma } from '@/generated/prisma/client';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const { page, pageSize } = parseListQuery(req);
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') ?? undefined;
  const severityFilter = url.searchParams.get('severity') ?? undefined;
  const typeFilter = url.searchParams.get('type') ?? undefined;
  const mineIdFilter = url.searchParams.get('mineId') ?? undefined;
  const orderBy = parseSort(url.searchParams.get('sort') ?? undefined, ['severity', 'createdAt', 'updatedAt']);

  const where: Prisma.AlertWhereInput = {
    ...(me.role === 'MINE_OFFICIAL' ? mineScopeFilter(me) : {}),
    ...(mineIdFilter ? { mineId: mineIdFilter } : {}),
    ...(statusFilter ? { status: statusFilter as Prisma.EnumAlertStatusFilter } : {}),
    ...(severityFilter ? { severity: severityFilter as Prisma.EnumAlertSeverityFilter } : {}),
    ...(typeFilter ? { type: typeFilter as Prisma.EnumAlertTypeFilter } : {}),
  };

  const [items, total] = await Promise.all([
    db.alert.findMany({
      where,
      orderBy,
      ...paginate(page, pageSize),
      include: {
        mine: { select: { id: true, name: true, code: true } },
        inspection: { select: { id: true, scheduledDate: true, status: true } },
        violation: { select: { id: true, code: true, severity: true } },
        report: { select: { id: true, title: true, type: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        acknowledgedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    db.alert.count({ where }),
  ]);

  return ok({ items, page, pageSize, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['MINE_OFFICIAL', 'CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = CreateAlertBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid alert payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  // MINE_OFFICIAL may only create alerts for their own mine.
  if (me.role === 'MINE_OFFICIAL' && me.mineId) {
    if (parsed.data.mineId && parsed.data.mineId !== me.mineId) {
      return bad('You can only create alerts for your own mine', 'FORBIDDEN', undefined, 403);
    }
    parsed.data.mineId = me.mineId;
  }

  // Validate the optional relations, if provided.
  if (parsed.data.mineId) {
    const m = await db.mine.findUnique({ where: { id: parsed.data.mineId } });
    if (!m) return bad('Referenced mineId does not exist', 'VALIDATION_ERROR');
  }
  if (parsed.data.inspectionId) {
    const i = await db.inspection.findUnique({ where: { id: parsed.data.inspectionId } });
    if (!i) return bad('Referenced inspectionId does not exist', 'VALIDATION_ERROR');
  }
  if (parsed.data.violationId) {
    const v = await db.violation.findUnique({ where: { id: parsed.data.violationId } });
    if (!v) return bad('Referenced violationId does not exist', 'VALIDATION_ERROR');
  }
  if (parsed.data.reportId) {
    const r = await db.report.findUnique({ where: { id: parsed.data.reportId } });
    if (!r) return bad('Referenced reportId does not exist', 'VALIDATION_ERROR');
  }
  if (parsed.data.assignedToId) {
    const u = await db.user.findUnique({ where: { id: parsed.data.assignedToId } });
    if (!u) return bad('Referenced assignedToId does not exist', 'VALIDATION_ERROR');
  }

  const createData: Prisma.AlertCreateInput = {
    type: parsed.data.type ?? 'MANUAL',
    severity: parsed.data.severity ?? 'MEDIUM',
    status: parsed.data.status ?? 'OPEN',
    title: parsed.data.title,
    message: parsed.data.message,
    triggerData: (parsed.data.triggerData ?? null) as Prisma.InputJsonValue,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
  };
  if (parsed.data.mineId) createData.mine = { connect: { id: parsed.data.mineId } };
  if (parsed.data.inspectionId) createData.inspection = { connect: { id: parsed.data.inspectionId } };
  if (parsed.data.violationId) createData.violation = { connect: { id: parsed.data.violationId } };
  if (parsed.data.reportId) createData.report = { connect: { id: parsed.data.reportId } };
  if (parsed.data.assignedToId) createData.assignedTo = { connect: { id: parsed.data.assignedToId } };

  const created = await db.alert.create({ data: createData });
  await audit({ actorId: me.id, action: 'ALERT_CREATE', resource: 'Alert', resourceId: created.id, payload: parsed.data });
  return ok(created, 201);
}
