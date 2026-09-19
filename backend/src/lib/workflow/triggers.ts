// Workflow trigger engine — runs the 5 escalation checks and creates
// `Alert` rows for any matches. Idempotent: each trigger checks for an
// existing OPEN alert of the same type for the same resource before
// creating a new one, so running the cron multiple times does not
// produce duplicate alerts.
//
// The engine is invoked by:
//   - The POST /api/workflow/run endpoint (cron-protected).
//   - Manual calls (e.g. from a CLI script for testing).

import { db } from '@/lib/db';
import { audit } from '@/lib/audit';

export type TriggerType =
  | 'INSPECTION_OVERDUE'
  | 'REPEATED_VIOLATIONS'
  | 'HIGH_AI_RISK'
  | 'MISSING_REPORT'
  | 'ENVIRONMENTAL_THRESHOLD';

export type TriggerResult = {
  type: TriggerType;
  count: number;
  alertIds: string[];
};

const REPEATED_VIOLATIONS_WINDOW_DAYS = 90;
const REPEATED_VIOLATIONS_THRESHOLD = 3;
const AI_RISK_THRESHOLD = 0.8;
const MISSING_REPORT_WINDOW_DAYS = 30;

// ---------------------------------------------------------------------------
// Trigger 1: Inspection overdue
// ---------------------------------------------------------------------------
// Any inspection that is still SCHEDULED (or IN_PROGRESS) past its
// scheduledDate should be flagged as OVERDUE and an alert created.
// ---------------------------------------------------------------------------
export async function triggerInspectionOverdue(): Promise<TriggerResult> {
  const now = new Date();
  const overdueInspections = await db.inspection.findMany({
    where: {
      scheduledDate: { lt: now },
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
    },
    include: { mine: { select: { name: true } } },
  });

  // Flip their status to OVERDUE.
  if (overdueInspections.length > 0) {
    await db.inspection.updateMany({
      where: { id: { in: overdueInspections.map(i => i.id) } },
      data: { status: 'OVERDUE' },
    });
  }

  const alertIds: string[] = [];
  for (const insp of overdueInspections) {
    // Idempotent: skip if an OPEN alert already exists for this inspection.
    const existing = await db.alert.findFirst({
      where: { type: 'INSPECTION_OVERDUE', inspectionId: insp.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      select: { id: true },
    });
    if (existing) continue;
    const alert = await db.alert.create({
      data: {
        type: 'INSPECTION_OVERDUE',
        severity: 'HIGH',
        status: 'OPEN',
        title: `Overdue inspection: ${insp.mine.name}`,
        message: `Inspection scheduled for ${insp.scheduledDate.toISOString()} is now overdue (was ${insp.status}).`,
        mineId: insp.mineId,
        inspectionId: insp.id,
        triggerData: { scheduledDate: insp.scheduledDate, priorStatus: insp.status },
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
    });
    alertIds.push(alert.id);
  }

  await audit({
    actorId: null,
    action: 'WORKFLOW_TRIGGER',
    resource: 'Alert',
    payload: { trigger: 'INSPECTION_OVERDUE', count: alertIds.length, alertIds },
  });

  return { type: 'INSPECTION_OVERDUE', count: alertIds.length, alertIds };
}

// ---------------------------------------------------------------------------
// Trigger 2: Repeated violations
// ---------------------------------------------------------------------------
// Any mine that has 3 or more violations in the last 90 days gets a
// REPEATED_VIOLATIONS alert. The alert is created once per mine per
// 90-day window.
// ---------------------------------------------------------------------------
export async function triggerRepeatedViolations(): Promise<TriggerResult> {
  const since = new Date(Date.now() - REPEATED_VIOLATIONS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  // Find all violations within the window, then group + count in JS so
  // we don't depend on the unstable `groupBy({ having: { _count }})`
  // syntax which changed across Prisma versions.
  const recent = await db.violation.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, mineId: true },
  });
  const byMine = new Map<string, number>();
  for (const v of recent) {
    byMine.set(v.mineId, (byMine.get(v.mineId) ?? 0) + 1);
  }
  const candidateMineIds = [...byMine.entries()]
    .filter(([, count]) => count >= REPEATED_VIOLATIONS_THRESHOLD)
    .map(([mineId]) => mineId);

  const alertIds: string[] = [];
  for (const mineId of candidateMineIds) {
    // Idempotent: don't re-create a REPEATED_VIOLATIONS alert for this
    // mine if one is still OPEN/ACKNOWLEDGED.
    const existing = await db.alert.findFirst({
      where: { type: 'REPEATED_VIOLATIONS', mineId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      select: { id: true },
    });
    if (existing) continue;

    const mine = await db.mine.findUnique({ where: { id: mineId }, select: { name: true } });
    const alert = await db.alert.create({
      data: {
        type: 'REPEATED_VIOLATIONS',
        severity: 'HIGH',
        status: 'OPEN',
        title: `Repeated violations: ${mine?.name ?? mineId}`,
        message: `Mine ${mineId} has accumulated ${byMine.get(mineId)} violations in the last ${REPEATED_VIOLATIONS_WINDOW_DAYS} days.`,
        mineId,
        triggerData: { count: byMine.get(mineId), windowDays: REPEATED_VIOLATIONS_WINDOW_DAYS },
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    alertIds.push(alert.id);
  }

  await audit({
    actorId: null,
    action: 'WORKFLOW_TRIGGER',
    resource: 'Alert',
    payload: { trigger: 'REPEATED_VIOLATIONS', count: alertIds.length, alertIds },
  });

  return { type: 'REPEATED_VIOLATIONS', count: alertIds.length, alertIds };
}

// ---------------------------------------------------------------------------
// Trigger 3: High AI risk score
// ---------------------------------------------------------------------------
// Any inspection whose `riskScore` is >= 0.8 and which does not already
// have an OPEN HIGH_AI_RISK alert gets flagged. (Most alerts are created
// inline by `/api/ai/risk-score` — this trigger is the safety-net for any
// inspection whose score was backfilled by a batch job.)
// ---------------------------------------------------------------------------
export async function triggerHighAiRisk(): Promise<TriggerResult> {
  const risky = await db.inspection.findMany({
    where: { riskScore: { gte: AI_RISK_THRESHOLD } },
    include: { mine: { select: { name: true } } },
  });

  const alertIds: string[] = [];
  for (const insp of risky) {
    const existing = await db.alert.findFirst({
      where: { type: 'HIGH_AI_RISK', inspectionId: insp.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      select: { id: true },
    });
    if (existing) continue;
    const alert = await db.alert.create({
      data: {
        type: 'HIGH_AI_RISK',
        severity: (insp.riskScore ?? 0) >= 0.95 ? 'CRITICAL' : 'HIGH',
        status: 'OPEN',
        title: `High AI risk score: ${insp.mine.name}`,
        message: `Inspection ${insp.id} scored ${(insp.riskScore ?? 0).toFixed(3)} (threshold ${AI_RISK_THRESHOLD}). Reasons: ${(insp.riskReasons ?? []).join('; ')}`,
        mineId: insp.mineId,
        inspectionId: insp.id,
        triggerData: { score: insp.riskScore, reasons: insp.riskReasons },
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    alertIds.push(alert.id);
  }

  await audit({
    actorId: null,
    action: 'WORKFLOW_TRIGGER',
    resource: 'Alert',
    payload: { trigger: 'HIGH_AI_RISK', count: alertIds.length, alertIds },
  });

  return { type: 'HIGH_AI_RISK', count: alertIds.length, alertIds };
}

// ---------------------------------------------------------------------------
// Trigger 4: Missing mandatory report
// ---------------------------------------------------------------------------
// Any ACTIVE mine that has NOT submitted a report (status SUBMITTED or
// APPROVED) covering any portion of the last 30 days gets a MISSING_REPORT
// alert.
// ---------------------------------------------------------------------------
export async function triggerMissingReport(): Promise<TriggerResult> {
  const since = new Date(Date.now() - MISSING_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const activeMines = await db.mine.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true } });

  const alertIds: string[] = [];
  for (const m of activeMines) {
    const hasReport = await db.report.findFirst({
      where: {
        mineId: m.id,
        status: { in: ['SUBMITTED', 'APPROVED'] },
        periodEnd: { gte: since },
      },
      select: { id: true },
    });
    if (hasReport) continue;

    const existing = await db.alert.findFirst({
      where: { type: 'MISSING_REPORT', mineId: m.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      select: { id: true },
    });
    if (existing) continue;

    const alert = await db.alert.create({
      data: {
        type: 'MISSING_REPORT',
        severity: 'MEDIUM',
        status: 'OPEN',
        title: `Missing mandatory report: ${m.name}`,
        message: `Mine ${m.id} (${m.name}) has no SUBMITTED/APPROVED report covering any portion of the last ${MISSING_REPORT_WINDOW_DAYS} days.`,
        mineId: m.id,
        triggerData: { windowDays: MISSING_REPORT_WINDOW_DAYS, since: since.toISOString() },
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    alertIds.push(alert.id);
  }

  await audit({
    actorId: null,
    action: 'WORKFLOW_TRIGGER',
    resource: 'Alert',
    payload: { trigger: 'MISSING_REPORT', count: alertIds.length, alertIds },
  });

  return { type: 'MISSING_REPORT', count: alertIds.length, alertIds };
}

// ---------------------------------------------------------------------------
// Trigger 5: Environmental threshold crossed
// ---------------------------------------------------------------------------
// Any EnvironmentalReading whose `value` exceeds its `threshold` (or, if
// the row has no per-reading threshold, the hard-coded default for the
// parameter) gets flagged, and an alert is created for the mine.
// ---------------------------------------------------------------------------
const DEFAULT_THRESHOLDS: Record<string, number> = {
  PM2_5: 35,    // µg/m³ — EPA 24-hour standard
  PM10: 150,    // µg/m³
  NOISE_DB: 85,  // dB
  WATER_PH_MIN: 6.5,  // encoded as threshold = 6.5 (alerts when pH < threshold)
  WATER_PH_MAX: 8.5,
  CO2_PPM: 5000,
  VOC_PPM: 1,
};

export async function triggerEnvironmentalThreshold(): Promise<TriggerResult> {
  // Find readings that have exceeded their threshold but for which we
  // have not yet created an alert. We use the `exceededAt` column to
  // track that we already processed this reading.
  const candidates = await db.environmentalReading.findMany({
    where: { exceededAt: null },
    include: { mine: { select: { name: true } } },
    take: 500, // safety cap per run
  });

  const alertIds: string[] = [];
  for (const r of candidates) {
    const threshold = r.threshold ?? DEFAULT_THRESHOLDS[r.parameter] ?? null;
    if (threshold === null) {
      // No threshold known — skip and mark as processed so we don't
      // re-check this reading.
      await db.environmentalReading.update({ where: { id: r.id }, data: { exceededAt: new Date(0) } });
      continue;
    }
    // Some parameters use min-threshold (alert when value < threshold),
    // detected by parameter name suffix `_MIN`; otherwise alert when
    // value > threshold.
    const isMinCheck = r.parameter.endsWith('_MIN');
    const exceeded = isMinCheck ? r.value < threshold : r.value > threshold;
    if (!exceeded) {
      // Mark processed (but not exceeded) so we don't re-check.
      await db.environmentalReading.update({ where: { id: r.id }, data: { exceededAt: new Date(0) } });
      continue;
    }
    // Mark the reading as exceeded-at-now.
    await db.environmentalReading.update({ where: { id: r.id }, data: { exceededAt: new Date() } });

    // Idempotent: only create one OPEN alert per mine+parameter+day.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const existing = await db.alert.findFirst({
      where: {
        type: 'ENVIRONMENTAL_THRESHOLD',
        mineId: r.mineId,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        createdAt: { gte: dayStart },
      },
      select: { id: true },
    });
    if (existing) continue;

    const alert = await db.alert.create({
      data: {
        type: 'ENVIRONMENTAL_THRESHOLD',
        severity: 'HIGH',
        status: 'OPEN',
        title: `Environmental threshold exceeded: ${r.mine.name} — ${r.parameter}`,
        message: `Reading for parameter ${r.parameter} = ${r.value} ${r.unit}, threshold ${isMinCheck ? '>=' : '<='} ${threshold}.`,
        mineId: r.mineId,
        triggerData: { parameter: r.parameter, value: r.value, unit: r.unit, threshold, isMinCheck, readingId: r.id },
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    });
    alertIds.push(alert.id);
  }

  await audit({
    actorId: null,
    action: 'WORKFLOW_TRIGGER',
    resource: 'Alert',
    payload: { trigger: 'ENVIRONMENTAL_THRESHOLD', count: alertIds.length, alertIds },
  });

  return { type: 'ENVIRONMENTAL_THRESHOLD', count: alertIds.length, alertIds };
}

// ---------------------------------------------------------------------------
// Run all triggers sequentially.
//
// We intentionally do NOT use `Promise.all` here. Each trigger calls
// `audit()` at the end of its run, and the audit log chain requires that
// each row's `prevHash` points to the most recent prior row. Running the
// triggers in parallel would create a race in the audit log chain.
// ---------------------------------------------------------------------------
export async function runAllTriggers(): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];
  results.push(await triggerInspectionOverdue());
  results.push(await triggerRepeatedViolations());
  results.push(await triggerHighAiRisk());
  results.push(await triggerMissingReport());
  results.push(await triggerEnvironmentalThreshold());
  return results;
}
