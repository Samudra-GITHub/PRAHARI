// POST /api/workflow/run
// Runs all 5 escalation triggers. Protected by the `x-cron-secret` header
// (must match env `CRON_SECRET`). Does NOT require JWT — this endpoint is
// invoked by the scheduler (Vercel Cron / Cloud Scheduler / etc.).

import type { NextRequest } from 'next/server';
import { ok, bad } from '@/lib/http';
import { runAllTriggers } from '@/lib/workflow/triggers';

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // CRON_SECRET not configured — refuse all calls.
    return bad('CRON_SECRET is not configured on the server; cannot run workflow.', 'CRON_NOT_CONFIGURED', undefined, 503);
  }
  const supplied = req.headers.get('x-cron-secret');
  if (!supplied || supplied !== expected) {
    return bad('Missing or incorrect x-cron-secret header.', 'CRON_UNAUTHORIZED', undefined, 401);
  }
  const results = await runAllTriggers();
  return ok({ triggered: results, createdAt: new Date().toISOString() });
}
