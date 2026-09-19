// AI Risk Score service.
//
// Deterministic, explainable risk scorer for inspections. The score is a
// number in [0,1] produced from a weighted checklist of risk factors
// derived from the inspection summary, findings, status, and the mine's
// compliance score. The score and the contributing reasons are persisted
// back to the inspection row and an alert is created if the score is
// >= 0.8 (HIGH_AI_RISK trigger).
//
// Note: this is intentionally a deterministic heuristic, not an LLM call,
// so it can run in unit tests and inside the cron without external API
// keys. The frontend team can layer an LLM-based explanation on top if
// needed — the contract surface (input/output) is unchanged.

import { db } from '@/lib/db';
import { audit } from '@/lib/audit';

export type AiRiskInput = {
  inspectionId: string;
  summary?: string;
  findings?: Record<string, unknown>;
};

export type AiRiskOutput = {
  inspectionId: string;
  score: number;          // 0..1
  reasons: string[];
  alertId: string | null; // created when score >= 0.8
};

const KEYWORDS_SEVERE = ['fire', 'explosion', 'collapse', 'fatality', 'casualty', 'overdose', 'spill'];
const KEYWORDS_MODERATE = ['leak', 'noise', 'dust', 'crack', 'rust', 'overdue', 'failed', 'missing', 'incomplete'];
const KEYWORDS_LOW = ['minor', 'documentation', 'training', 'cosmetic'];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function evaluate(input: {
  summary?: string;
  findings?: Record<string, unknown>;
  status?: string;
  mineComplianceScore?: number;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const text = (input.summary ?? '').toLowerCase();
  const findings = input.findings ?? {};
  let score = 0.2; // baseline

  // Findings-as-violations: if the findings object has keys like
  // `violations`, `deficiencies`, the count contributes to the score.
  const violationCount = Array.isArray(findings.violations) ? findings.violations.length : 0;
  const deficiencyCount = Array.isArray(findings.deficiencies) ? findings.deficiencies.length : 0;
  const issueCount = violationCount + deficiencyCount;
  if (issueCount > 0) {
    score += Math.min(0.3, issueCount * 0.05);
    reasons.push(`${issueCount} issue(s) recorded in findings`);
  }

  // Keyword severity.
  for (const k of KEYWORDS_SEVERE) {
    if (text.includes(k) || JSON.stringify(findings).toLowerCase().includes(k)) {
      score += 0.2;
      reasons.push(`Severe keyword matched: "${k}"`);
    }
  }
  for (const k of KEYWORDS_MODERATE) {
    if (text.includes(k) || JSON.stringify(findings).toLowerCase().includes(k)) {
      score += 0.08;
      reasons.push(`Moderate keyword matched: "${k}"`);
    }
  }
  for (const k of KEYWORDS_LOW) {
    if (text.includes(k)) {
      score += 0.02;
      reasons.push(`Low-severity keyword matched: "${k}"`);
    }
  }

  // Mine compliance score — lower compliance = higher risk.
  if (typeof input.mineComplianceScore === 'number') {
    const missing = Math.max(0, 100 - input.mineComplianceScore) / 100;
    score += missing * 0.15;
    if (missing > 0.3) reasons.push(`Mine compliance score is low (${input.mineComplianceScore.toFixed(1)})`);
  }

  // Inspection status — OVERDUE or IN_PROGRESS boost the risk slightly.
  if (input.status === 'OVERDUE') {
    score += 0.1;
    reasons.push('Inspection is OVERDUE');
  } else if (input.status === 'IN_PROGRESS') {
    score += 0.03;
    reasons.push('Inspection is IN_PROGRESS');
  }

  // Empty summary + no findings is itself a yellow flag.
  if (!text && issueCount === 0) {
    score += 0.05;
    reasons.push('Inspection has no summary and no findings recorded');
  }

  return { score: clamp01(score), reasons };
}

export async function computeAiRisk(input: AiRiskInput, actorId?: string): Promise<AiRiskOutput> {
  const inspection = await db.inspection.findUnique({
    where: { id: input.inspectionId },
    include: { mine: { select: { complianceScore: true } } },
  });
  if (!inspection) {
    throw new Error('Inspection not found');
  }
  const summary = input.summary ?? inspection.summary ?? undefined;
  const findings = input.findings ?? (inspection.findings as Record<string, unknown> | null) ?? undefined;
  const { score, reasons } = evaluate({
    summary,
    findings,
    status: inspection.status,
    mineComplianceScore: inspection.mine.complianceScore,
  });

  await db.inspection.update({
    where: { id: inspection.id },
    data: { riskScore: score, riskReasons: reasons },
  });

  let alertId: string | null = null;
  if (score >= 0.8) {
    // Idempotent — don't create a duplicate HIGH_AI_RISK alert for the
    // same inspection if one already exists.
    const existing = await db.alert.findFirst({
      where: { type: 'HIGH_AI_RISK', inspectionId: inspection.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      select: { id: true },
    });
    if (!existing) {
      const alert = await db.alert.create({
        data: {
          type: 'HIGH_AI_RISK',
          severity: score >= 0.95 ? 'CRITICAL' : 'HIGH',
          status: 'OPEN',
          title: `High AI risk score (${(score * 100).toFixed(0)}%) for inspection`,
          message: `Inspection ${inspection.id} on mine ${inspection.mineId} scored ${score.toFixed(3)}. Reasons: ${reasons.join('; ')}`,
          mineId: inspection.mineId,
          inspectionId: inspection.id,
          triggerData: { score, reasons },
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      alertId = alert.id;
    } else {
      alertId = existing.id;
    }
  }

  await audit({
    actorId: actorId ?? null,
    action: 'AI_RISK_SCORE',
    resource: 'Inspection',
    resourceId: inspection.id,
    payload: { score, reasons, alertId },
  });

  return { inspectionId: inspection.id, score, reasons, alertId };
}
