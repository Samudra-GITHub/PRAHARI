// GET /api/environmental-readings (paginated + filtered)
// POST /api/environmental-readings (record a reading; trigger workflow may run on next cron)

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, forbidden } from '@/lib/http';
import { CreateEnvironmentalReadingBody } from '@/lib/validators';
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
  const parameterFilter = url.searchParams.get('parameter') ?? undefined;
  const orderBy = parseSort(url.searchParams.get('sort') ?? undefined, ['createdAt', 'value']);

  const where: Prisma.EnvironmentalReadingWhereInput = {
    ...(me.role === 'MINE_OFFICIAL' ? mineScopeFilter(me) : {}),
    ...(mineIdFilter ? { mineId: mineIdFilter } : {}),
    ...(parameterFilter ? { parameter: parameterFilter } : {}),
  };

  const [items, total] = await Promise.all([
    db.environmentalReading.findMany({
      where, orderBy, ...paginate(page, pageSize),
      include: { mine: { select: { id: true, name: true, code: true } } },
    }),
    db.environmentalReading.count({ where }),
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
  const parsed = CreateEnvironmentalReadingBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid environmental reading payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  if (me.role === 'MINE_OFFICIAL' && me.mineId && parsed.data.mineId !== me.mineId) {
    return forbidden('You can only record readings for your own mine');
  }
  const m = await db.mine.findUnique({ where: { id: parsed.data.mineId } });
  if (!m) return bad('Referenced mineId does not exist', 'VALIDATION_ERROR');

  const created = await db.environmentalReading.create({
    data: {
      mine: { connect: { id: parsed.data.mineId } },
      parameter: parsed.data.parameter,
      value: parsed.data.value,
      unit: parsed.data.unit,
      threshold: parsed.data.threshold ?? null,
    },
    include: { mine: { select: { id: true, name: true, code: true } } },
  });
  await audit({ actorId: me.id, action: 'ENV_READING_CREATE', resource: 'EnvironmentalReading', resourceId: created.id, payload: parsed.data });
  return ok(created, 201);
}
