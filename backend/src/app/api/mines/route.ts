// GET /api/mines         — list mines (role-scoped)
// POST /api/mines        — create a mine (CORPORATE_ADMIN only)

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, conflict } from '@/lib/http';
import { CreateMineBody } from '@/lib/validators';
import { requireRole, type MyRequest, mineSelfFilter } from '@/lib/rbac';
import { parseListQuery, parseSort, paginate } from '@/lib/pagination';
import { audit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const { page, pageSize, search } = parseListQuery(req);
  const orderBy = parseSort(req.nextUrl.searchParams.get('sort') ?? undefined, ['name', 'code', 'createdAt', 'updatedAt']);

  const where = {
    // MINE_OFFICIAL sees only their own mine. The Mine model is keyed by `id`,
    // so this uses mineSelfFilter — mineScopeFilter's `{ mineId }` is for
    // child tables and made Prisma reject this query for mine officials.
    ...mineSelfFilter(me),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { code: { contains: search, mode: 'insensitive' as const } },
        { location: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [items, total] = await Promise.all([
    db.mine.findMany({ where, orderBy, ...paginate(page, pageSize) }),
    db.mine.count({ where }),
  ]);

  return ok({ items, page, pageSize, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = CreateMineBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid mine payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  const existing = await db.mine.findUnique({ where: { code: parsed.data.code } });
  if (existing) return conflict('A mine with that code already exists');

  const created = await db.mine.create({ data: parsed.data });
  await audit({ actorId: me.id, action: 'MINE_CREATE', resource: 'Mine', resourceId: created.id, payload: parsed.data });
  return ok(created, 201);
}
