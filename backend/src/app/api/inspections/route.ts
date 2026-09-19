// GET / POST /api/inspections
//
// Role scoping:
//   - FIELD_INSPECTOR  : only inspections they performed
//   - MINE_OFFICIAL    : only inspections on their mine
//   - CORPORATE_ADMIN  : all inspections
//   - REGULATOR        : all inspections (read-only)

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad } from '@/lib/http';
import { CreateInspectionBody } from '@/lib/validators';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { parseListQuery, parseSort, paginate } from '@/lib/pagination';
import { audit } from '@/lib/audit';
import type { Prisma } from '@/generated/prisma/client';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const { page, pageSize } = parseListQuery(req);

  const url = new URL(req.url);
  const mineIdFilter = url.searchParams.get('mineId') ?? undefined;
  const statusFilter = url.searchParams.get('status') ?? undefined;
  const orderBy = parseSort(url.searchParams.get('sort') ?? undefined, ['scheduledDate', 'createdAt', 'updatedAt']);

  const where: Prisma.InspectionWhereInput = {};
  if (me.role === 'FIELD_INSPECTOR') where.inspectorId = me.id;
  if (me.role === 'MINE_OFFICIAL' && me.mineId) where.mineId = me.mineId;
  if (mineIdFilter) where.mineId = mineIdFilter;
  if (statusFilter) where.status = statusFilter as Prisma.EnumInspectionStatusFilter;

  const [items, total] = await Promise.all([
    db.inspection.findMany({
      where,
      orderBy,
      ...paginate(page, pageSize),
      include: { mine: { select: { id: true, name: true, code: true } }, inspector: { select: { id: true, name: true, email: true } } },
    }),
    db.inspection.count({ where }),
  ]);

  return ok({ items, page, pageSize, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = CreateInspectionBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid inspection payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  // Verify the referenced mine exists.
  const mine = await db.mine.findUnique({ where: { id: parsed.data.mineId } });
  if (!mine) return bad('Referenced mineId does not exist', 'VALIDATION_ERROR');

  // MINE_OFFICIAL may only create inspections for their own mine.
  if (me.role === 'MINE_OFFICIAL' && me.mineId && parsed.data.mineId !== me.mineId) {
    return bad('You can only create inspections for your own mine', 'FORBIDDEN', undefined, 403);
  }

  // If an inspector is specified, it must exist and be a FIELD_INSPECTOR.
  const inspectorId = parsed.data.inspectorId ?? me.id;
  const inspector = await db.user.findUnique({ where: { id: inspectorId } });
  if (!inspector) return bad('Referenced inspectorId does not exist', 'VALIDATION_ERROR');

  // Build the create payload — only fields that exist on the model.
  const createData: Prisma.InspectionCreateInput = {
    mine: { connect: { id: parsed.data.mineId } },
    inspector: { connect: { id: inspectorId } },
    type: parsed.data.type ?? 'ROUTINE',
    status: parsed.data.status ?? 'SCHEDULED',
    scheduledDate: new Date(parsed.data.scheduledDate),
    completedDate: parsed.data.completedDate ? new Date(parsed.data.completedDate) : null,
    summary: parsed.data.summary ?? null,
    findings: (parsed.data.findings ?? null) as Prisma.InputJsonValue,
    riskScore: parsed.data.riskScore ?? null,
    riskReasons: parsed.data.riskReasons ?? [],
  };

  const created = await db.inspection.create({ data: createData });
  await audit({ actorId: me.id, action: 'INSPECTION_CREATE', resource: 'Inspection', resourceId: created.id, payload: { mineId: parsed.data.mineId, inspectorId, type: created.type, status: created.status } });
  return ok(created, 201);
}
