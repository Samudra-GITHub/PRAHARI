// Mine risk classification, derived from the real `Mine.complianceScore`
// field (backend/prisma/schema.prisma — a Float 0-100 the backend already
// tracks). The backend has no separate "risk level" concept anywhere in its
// API — this is a presentation-only banding rule applied to that real
// number, not a value the backend computes or returns itself. Keep the
// thresholds here, in one place, so the UI's claim about what "high risk"
// means stays honest and auditable.

export type RiskLevel = 'low' | 'medium' | 'high';

export const RISK_THRESHOLDS = {
  // score < HIGH_MAX => high risk
  HIGH_MAX: 60,
  // HIGH_MAX <= score < MEDIUM_MAX => medium risk; score >= MEDIUM_MAX => low risk
  MEDIUM_MAX: 85,
} as const;

export function classifyMineRisk(complianceScore: number): RiskLevel {
  if (complianceScore < RISK_THRESHOLDS.HIGH_MAX) return 'high';
  if (complianceScore < RISK_THRESHOLDS.MEDIUM_MAX) return 'medium';
  return 'low';
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  high: 'High Risk',
  medium: 'Medium Risk',
  low: 'Low Risk',
};
