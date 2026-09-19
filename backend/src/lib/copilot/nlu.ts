// Deterministic intent detection + entity extraction for PRAHARI Copilot.
//
// This is intentionally rule-based rather than a second LLM call: it must
// resolve which *real* records to retrieve before the LLM ever runs, so a
// misclassification here would either retrieve nothing (safe — the answer
// says so) or retrieve the wrong-but-still-real records (safe — still
// grounded, just not what was asked). It can never fabricate a record.
//
// Keyword sets are deliberately generous (synonyms, plurals, common
// phrasing) since the product brief expects free-form questions like a
// regulator would actually ask.

import type { ConversationContext, CopilotIntent, MineLite, NluResult, ResolvedEntities } from './types';

const ORDINALS: Record<string, number> = {
  first: 0, '1st': 0,
  second: 1, '2nd': 1,
  third: 2, '3rd': 2,
  fourth: 3, '4th': 3,
  fifth: 4, '5th': 4,
};

// Maps a spoken environmental term to substrings that could appear in the
// real `EnvironmentalReading.parameter` free-text field. Matching happens
// against parameters that actually exist in the data (see retrieval.ts) —
// this dictionary only decides which *real* values count as a match for a
// given word, it never invents a parameter.
const ENV_SYNONYMS: Record<string, string[]> = {
  methane: ['methane', 'ch4'],
  gas: ['methane', 'ch4', 'co', 'co2'],
  dust: ['pm2', 'pm10', 'dust', 'particulate'],
  particulate: ['pm2', 'pm10', 'particulate'],
  noise: ['noise', 'db'],
  temperature: ['temp'],
  humidity: ['humid'],
  emission: ['emission', 'co2', 'so2', 'nox'],
  emissions: ['emission', 'co2', 'so2', 'nox'],
  water: ['water', 'ph'],
  ph: ['ph'],
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function resolveMineIds(q: string, mines: MineLite[], context: ConversationContext): string[] {
  const direct: string[] = [];
  for (const m of mines) {
    const name = m.name.toLowerCase();
    const code = m.code.toLowerCase();
    if (q.includes(name) || (code.length >= 3 && q.includes(code))) direct.push(m.id);
  }
  if (direct.length > 0) return direct;

  // Ordinal reference into the list shown in the previous turn: "why is the
  // second one risky".
  const ordinalWord = Object.keys(ORDINALS).find((w) => new RegExp(`\\b${w}\\b`).test(q));
  if (ordinalWord && context.lastMineIds && context.lastMineIds[ORDINALS[ordinalWord]]) {
    return [context.lastMineIds[ORDINALS[ordinalWord]]];
  }

  // Pronoun reference to whatever mine is currently in focus.
  if (/\b(it|its|that mine|this mine|the mine)\b/.test(q) && context.focusedMineId) {
    return [context.focusedMineId];
  }

  return [];
}

function resolveRegion(q: string, mines: MineLite[]): string | undefined {
  const regions = Array.from(new Set(mines.map((m) => m.region).filter((r): r is string => Boolean(r))));
  return regions.find((r) => q.includes(r.toLowerCase()));
}

function resolveTimeRangeDays(q: string): number | undefined {
  if (/\btoday\b/.test(q)) return 1;
  if (/\byesterday\b/.test(q)) return 2;
  if (/\bthis week\b|\bpast week\b|\blast 7 days\b/.test(q)) return 7;
  if (/\bpast 30 days\b|\blast month\b|\bthis month\b|\bpast month\b/.test(q)) return 30;
  if (/\bpast 90 days\b|\blast quarter\b/.test(q)) return 90;
  return undefined;
}

function resolveEnvParam(q: string): string | undefined {
  for (const [word, hints] of Object.entries(ENV_SYNONYMS)) {
    if (q.includes(word)) return hints[0]; // matched below via substring OR across hints in retrieval.ts
  }
  return undefined;
}

export function detectIntent(question: string, mines: MineLite[], context: ConversationContext): NluResult {
  const q = normalize(question);
  const mineIds = resolveMineIds(q, mines, context);
  const region = resolveRegion(q, mines);
  const timeRangeDays = resolveTimeRangeDays(q);
  const environmentalParameter = resolveEnvParam(q);
  const repeated = /\brepeated\b|\brecurring\b|\bmultiple\b.*\b(violation|breach)/.test(q);
  const critical = /\bcritical\b/.test(q);

  // "why did the AI assign risk score 82" / "risk score of 0.82" — a bare
  // number near the words "risk"/"score" is treated as a score to look up.
  let mentionedScore: number | undefined;
  const scoreMatch = q.match(/(?:risk|score)[^\d]{0,12}(\d+(?:\.\d+)?)/) ?? q.match(/(\d+(?:\.\d+)?)[^\d]{0,12}(?:risk|score)/);
  if (scoreMatch) {
    const raw = Number(scoreMatch[1]);
    if (!Number.isNaN(raw)) mentionedScore = raw > 1 ? raw / 100 : raw;
  }

  let violationStatus: ResolvedEntities['violationStatus'];
  if (/\bopen\b|\bpending\b|\boutstanding\b/.test(q)) violationStatus = 'OPEN';
  else if (/\bresolved\b|\brectified\b/.test(q)) violationStatus = 'RECTIFIED';
  else if (/\bescalated\b/.test(q)) violationStatus = 'ESCALATED';
  else if (/\bclosed\b/.test(q)) violationStatus = 'CLOSED';

  let alertStatus: ResolvedEntities['alertStatus'];
  if (/\bactive\b|\bopen\b/.test(q)) alertStatus = 'OPEN';
  else if (/\bresolved\b/.test(q)) alertStatus = 'RESOLVED';
  else if (/\backnowledged\b/.test(q)) alertStatus = 'ACKNOWLEDGED';

  let reportStatus: ResolvedEntities['reportStatus'];
  if (/\bapproved\b/.test(q)) reportStatus = 'APPROVED';
  else if (/\bpending\b|\bsubmitted\b|\bawaiting\b/.test(q)) reportStatus = 'SUBMITTED';
  else if (/\brejected\b/.test(q)) reportStatus = 'REJECTED';
  else if (/\bdraft\b/.test(q)) reportStatus = 'DRAFT';

  let inspectionStatus: ResolvedEntities['inspectionStatus'];
  if (/\bcompleted\b|\bdone\b|\bfinished\b/.test(q)) inspectionStatus = 'COMPLETED';
  else if (/\boverdue\b/.test(q)) inspectionStatus = 'OVERDUE';
  else if (/\bscheduled\b|\bupcoming\b/.test(q)) inspectionStatus = 'SCHEDULED';
  else if (/\bin progress\b|\bongoing\b/.test(q)) inspectionStatus = 'IN_PROGRESS';
  else if (/\bcancelled\b|\bcanceled\b/.test(q)) inspectionStatus = 'CANCELLED';

  const entities: ResolvedEntities = {
    mineIds,
    region,
    timeRangeDays,
    environmentalParameter,
    violationStatus,
    violationSeverity: critical ? 'CRITICAL' : undefined,
    alertStatus,
    alertSeverity: critical ? 'CRITICAL' : undefined,
    reportStatus,
    inspectionStatus,
    repeated,
    critical,
    mentionedScore,
  };

  let intent: CopilotIntent = 'GENERAL';

  if (/\bgenerate\b/.test(q) && /\breport\b/.test(q)) {
    intent = 'GENERATE_REPORT';
  } else if (/\bwhy\b/.test(q) && (/\brisk\b/.test(q) || /\bscore\b/.test(q))) {
    intent = 'EXPLAIN_RISK';
  } else if (/\bexplain\b/.test(q) && /\brisk\b/.test(q)) {
    intent = 'EXPLAIN_RISK';
  } else if (/\bhighest.risk\b|\bmost risk\b|\briskiest\b|\brisk ranking\b|\bat risk today\b/.test(q) || (/\bwhich mine\b/.test(q) && /\brisk\b/.test(q))) {
    intent = 'HIGH_RISK_MINES';
  } else if (/\boverdue\b/.test(q) && /\binspect/.test(q)) {
    intent = 'OVERDUE_INSPECTIONS';
  } else if (/\brepeated\b.*\b(methane|breach|violation)\b|\brepeated violations\b/.test(q)) {
    intent = 'VIOLATIONS_QUERY';
  } else if (environmentalParameter || /\benvironmental\b|\bmethane\b|\bdust\b|\bemission/.test(q)) {
    intent = 'ENVIRONMENTAL_QUERY';
  } else if (/\bviolation/.test(q)) {
    intent = 'VIOLATIONS_QUERY';
  } else if (/\balert/.test(q)) {
    intent = 'ALERTS_QUERY';
  } else if (/\binspection/.test(q)) {
    intent = 'INSPECTION_HISTORY';
  } else if (/\breport/.test(q)) {
    intent = 'REPORTS_QUERY';
  } else if (/\bsafety timeline\b|\btimeline\b/.test(q) || (timeRangeDays && timeRangeDays >= 30)) {
    intent = 'SAFETY_TIMELINE';
  } else if (/\bcompliance summary\b|\btoday.s summary\b|\bsummary\b/.test(q)) {
    intent = 'COMPLIANCE_SUMMARY';
  } else if (/\bprofile\b|\boverview\b|\btell me about\b|\bstatus of\b|\bdigital profile\b/.test(q) && mineIds.length > 0) {
    intent = 'MINE_PROFILE';
  } else if (mineIds.length > 0) {
    intent = 'MINE_STATUS';
  }

  return { intent, entities };
}
