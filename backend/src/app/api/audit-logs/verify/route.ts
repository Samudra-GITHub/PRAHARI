// POST /api/audit-logs/verify
// Re-walks the audit log hash chain and returns a report indicating
// whether any rows have been retroactively edited or deleted.

import type { NextRequest } from 'next/server';
import { ok } from '@/lib/http';
import { requireRole } from '@/lib/rbac';
import { verifyChain } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['REGULATOR', 'CORPORATE_ADMIN']);
  if (!guard.ok) return guard.response;
  const report = await verifyChain();
  return ok(report);
}
