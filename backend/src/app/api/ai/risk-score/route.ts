// POST /api/ai/risk-score
// Computes an AI risk score (0..1) for an inspection and persists it.
// If the score is >= 0.8, an HIGH_AI_RISK alert is created automatically.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, notFound } from '@/lib/http';
import { AiRiskBody } from '@/lib/validators';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { computeAiRisk } from '@/lib/ai-risk';

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
  const parsed = AiRiskBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid AI risk payload', 'VALIDATION_ERROR', parsed.error.flatten());
  }

  const inspection = await db.inspection.findUnique({ where: { id: parsed.data.inspectionId } });
  if (!inspection) return notFound('Inspection not found');

  const result = await computeAiRisk(parsed.data, me.id);
  return ok(result);
}
