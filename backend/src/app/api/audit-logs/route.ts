// GET /api/audit-logs (paginated + filtered) — REGULATOR + CORPORATE_ADMIN

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok } from '@/lib/http';
import { requireRole } from '@/lib/rbac';
import { parseListQuery, parseSort, paginate } from '@/lib/pagination';
import type { Prisma } from '@/generated/prisma/client';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['REGULATOR', 'CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;

  const { page, pageSize } = parseListQuery(req);
  const url = new URL(req.url);
  const actionFilter = url.searchParams.get('action') ?? undefined;
  const resourceFilter = url.searchParams.get('resource') ?? undefined;
  const actorIdFilter = url.searchParams.get('actorId') ?? undefined;
  const resourceIdFilter = url.searchParams.get('resourceId') ?? undefined;
  const orderBy = parseSort(url.searchParams.get('sort') ?? undefined, ['createdAt', 'action']);

  const where: Prisma.AuditLogWhereInput = {
    ...(actionFilter ? { action: { contains: actionFilter, mode: 'insensitive' as const } } : {}),
    ...(resourceFilter ? { resource: resourceFilter } : {}),
    ...(actorIdFilter ? { actorId: actorIdFilter } : {}),
    ...(resourceIdFilter ? { resourceId: resourceIdFilter } : {}),
  };

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where, orderBy, ...paginate(page, pageSize),
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return ok({ items, page, pageSize, total });
}
