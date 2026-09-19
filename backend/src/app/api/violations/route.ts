// GET / POST /api/violations

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad } from '@/lib/http';
import { CreateViolationBody } from '@/lib/validators';
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
  const mineIdFilter = url.searchParams.get('mineId') ?? undefined;
  const statusFilter = url.searchParams.get('status') ?? undefined;
  const codeFilter = url.searchParams.get('code') ?? undefined;
  const orderBy = parseSort(url.searchParams.get('sort') ?? undefined, ['createdAt', 'updatedAt', 'penaltyAmount', 'escalationCount']);

  const where: Prisma.ViolationWhereInput = {
    ...(me.role === 'MINE_OFFICIAL' ? mineScopeFilter(me) : {}),
    ...(mineIdFilter ? { mineId: mineIdFilter } : {}),
    ...(statusFilter ? { status: statusFilter as Prisma.EnumViolationStatusFilter } : {}),
    ...(codeFilter ? { code: { contains: codeFilter, mode: 'insensitive' as const } } : {}),
  };

  const [items, total] = await Promise.all([
    db.violation.findMany({
      where, orderBy, ...paginate(page, pageSize),
      include: {
        mine: { select: { id: true, name: true, code: true } },
        inspection: { select: { id: true, scheduledDate: true, status: true } },
        issuedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    db.violation.count({ where }),
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
  const parsed = CreateViolationBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid violation payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  if (me.role === 'MINE_OFFICIAL' && me.mineId && parsed.data.mineId !== me.mineId) {
    return bad('You can only create violations for your own mine', 'FORBIDDEN', undefined, 403);
  }

  const m = await db.mine.findUnique({ where: { id: parsed.data.mineId } });
  if (!m) return bad('Referenced mineId does not exist', 'VALIDATION_ERROR');
  if (parsed.data.inspectionId) {
    const i = await db.inspection.findUnique({ where: { id: parsed.data.inspectionId } });
    if (!i) return bad('Referenced inspectionId does not exist', 'VALIDATION_ERROR');
  }

  const createData: Prisma.ViolationCreateInput = {
    mine: { connect: { id: parsed.data.mineId } },
    issuedBy: { connect: { id: me.id } },
    severity: parsed.data.severity ?? 'MINOR',
    status: parsed.data.status ?? 'OPEN',
    code: parsed.data.code,
    description: parsed.data.description,
    penaltyAmount: parsed.data.penaltyAmount ?? 0,
  };
  if (parsed.data.inspectionId) createData.inspection = { connect: { id: parsed.data.inspectionId } };

  const created = await db.violation.create({
    data: createData,
    include: {
      mine: { select: { id: true, name: true, code: true } },
      inspection: { select: { id: true, scheduledDate: true, status: true } },
      issuedBy: { select: { id: true, name: true, email: true } },
    },
  });
  await audit({ actorId: me.id, action: 'VIOLATION_CREATE', resource: 'Violation', resourceId: created.id, payload: parsed.data });
  return ok(created, 201);
}
