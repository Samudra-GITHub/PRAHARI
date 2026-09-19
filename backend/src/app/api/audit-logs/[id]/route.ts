// GET /api/audit-logs/[id] — REGULATOR + CORPORATE_ADMIN

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, notFound } from '@/lib/http';
import { requireRole } from '@/lib/rbac';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['REGULATOR', 'CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const log = await db.auditLog.findUnique({
    where: { id },
    include: { actor: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!log) return notFound('Audit log not found');
  return ok(log);
}
