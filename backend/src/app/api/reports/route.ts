// GET / POST /api/reports

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad } from '@/lib/http';
import { CreateReportBody } from '@/lib/validators';
import { requireRole, type MyRequest, mineScopeFilter } from '@/lib/rbac';
import { parseListQuery, parseSort, paginate } from '@/lib/pagination';
import { audit } from '@/lib/audit';
import type { Prisma } from '@/generated/prisma/client';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const { page, pageSize } = parseListQuery(req);
  const url = new URL(req.url);
  const mineIdFilter = url.searchParams.get('mineId') ?? undefined;
  const statusFilter = url.searchParams.get('status') ?? undefined;
  const typeFilter = url.searchParams.get('type') ?? undefined;
  const orderBy = parseSort(url.searchParams.get('sort') ?? undefined, ['createdAt', 'periodEnd', 'updatedAt']);

  const where: Prisma.ReportWhereInput = {
    ...(me.role === 'MINE_OFFICIAL' ? mineScopeFilter(me) : {}),
    ...(mineIdFilter ? { mineId: mineIdFilter } : {}),
    ...(statusFilter ? { status: statusFilter as Prisma.EnumReportStatusFilter } : {}),
    ...(typeFilter ? { type: typeFilter as Prisma.EnumReportTypeFilter } : {}),
  };

  const [items, total] = await Promise.all([
    db.report.findMany({
      where, orderBy, ...paginate(page, pageSize),
      include: { mine: { select: { id: true, name: true, code: true } }, author: { select: { id: true, name: true, email: true } } },
    }),
    db.report.count({ where }),
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
  const parsed = CreateReportBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid report payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  if (me.role === 'MINE_OFFICIAL' && me.mineId && parsed.data.mineId !== me.mineId) {
    return bad('You can only create reports for your own mine', 'FORBIDDEN', undefined, 403);
  }

  const m = await db.mine.findUnique({ where: { id: parsed.data.mineId } });
  if (!m) return bad('Referenced mineId does not exist', 'VALIDATION_ERROR');
  if (new Date(parsed.data.periodEnd) < new Date(parsed.data.periodStart)) {
    return bad('periodEnd must be >= periodStart', 'VALIDATION_ERROR');
  }

  const created = await db.report.create({
    data: {
      mine: { connect: { id: parsed.data.mineId } },
      author: { connect: { id: me.id } },
      type: parsed.data.type,
      status: 'DRAFT',
      title: parsed.data.title,
      body: parsed.data.body,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
    },
    include: { mine: { select: { id: true, name: true, code: true } }, author: { select: { id: true, name: true, email: true } } },
  });
  await audit({ actorId: me.id, action: 'REPORT_CREATE', resource: 'Report', resourceId: created.id, payload: { mineId: parsed.data.mineId, type: created.type, title: created.title } });
  return ok(created, 201);
}
