// backend/src/app/api/ai/risk-score/** — FIELD_INSPECTOR/MINE_OFFICIAL/CORPORATE_ADMIN.
// Computes and persists a 0..1 risk score for an inspection; scores >= 0.8
// auto-create a HIGH_AI_RISK alert server-side (backend/src/lib/ai-risk.ts).

import { api } from '@/lib/api';
import type { AiRiskBody } from '@/types/api';
import type { AiRiskResponse } from '@/types/models';

export function computeAiRiskScore(body: AiRiskBody): Promise<AiRiskResponse> {
  return api.post<AiRiskResponse>('/api/ai/risk-score', body);
}
