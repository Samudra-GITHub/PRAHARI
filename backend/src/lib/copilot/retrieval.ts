// Retrieval layer for PRAHARI Copilot.
//
// Every function here queries the same Prisma client and applies the exact
// same RBAC scoping helpers (`mineScopeFilter` / `mineSelfFilter` /
// per-role `where` clauses) as the equivalent REST route already does —
// see backend/src/app/api/{mines,inspections,violations,alerts,
// environmental-readings,reports}/route.ts, which this deliberately
// mirrors rather than reimplements independently. Copilot can never see
// more than the same user could already see by calling those endpoints
// directly.
//
// Nothing here calls an LLM. This module's only job is: given an intent and
// some entities, return the real rows that answer it, plus an evidence
// trail (record type + id) so the UI can cite exactly what was used.

import { db } from '@/lib/db';
import { can, mineScopeFilter, mineSelfFilter } from '@/lib/rbac';
import type { User, Prisma, AlertStatus, ViolationStatus } from '@/generated/prisma/client';
import type { ConversationContext, EvidenceRef, MineLite, NluResult, RetrievalResult } from './types';

// Matches the frontend's lib/risk.ts thresholds exactly (kept in sync
// manually — there is no shared package between the two apps). Presentation
// banding only; the backend has no separate "risk level" column.
const RISK_HIGH_MAX = 60;
const RISK_MEDIUM_MAX = 85;
function riskBand(score: number): 'high' | 'medium' | 'low' {
  if (score < RISK_HIGH_MAX) return 'high';
  if (score < RISK_MEDIUM_MAX) return 'medium';
  return 'low';
}

const OUTSTANDING_VIOLATION: ViolationStatus[] = ['OPEN', 'NOTIFIED', 'ESCALATED'];
const OUTSTANDING_ALERT: AlertStatus[] = ['OPEN', 'ACKNOWLEDGED'];

// ---------------------------------------------------------------------------
// Tiny process-local cache — this is a single Next.js server process for the
// hackathon deployment, so a Map is enough to satisfy "cache repeated
// lookups" without standing up Redis. Not shared across instances/replicas.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const MINE_LITE_SELECT = { id: true, name: true, code: true, region: true, complianceScore: true, status: true } as const;

export async function listAccessibleMines(me: User): Promise<MineLite[]> {
  return cached(`mines:${me.id}:${me.role}:${me.mineId}`, () =>
    db.mine.findMany({ where: mineSelfFilter(me), orderBy: { complianceScore: 'asc' }, select: MINE_LITE_SELECT }),
  );
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function mineEvidence(mines: MineLite[]): EvidenceRef[] {
  return mines.map((m) => ({ label: `${m.name} (${m.code})`, type: 'mine', id: m.id }));
}

function empty(intent: NluResult['intent'], entities: NluResult['entities'], nextContext: ConversationContext): RetrievalResult {
  return {
    intent,
    entities,
    mines: [],
    mineDetail: null,
    inspections: [],
    violations: [],
    alerts: [],
    readings: [],
    reports: [],
    summary: null,
    timeline: null,
    evidence: [],
    notes: [],
    reportAction: null,
    nextContext,
    deniedReason: null,
  };
}

export async function retrieve(nlu: NluResult, me: User, context: ConversationContext): Promise<RetrievalResult> {
  const { intent, entities } = nlu;
  const allMines = await listAccessibleMines(me);
  const result = empty(intent, entities, context);

  const targetMineIds = entities.mineIds.length > 0 ? entities.mineIds : entities.region
    ? allMines.filter((m) => m.region?.toLowerCase() === entities.region!.toLowerCase()).map((m) => m.id)
    : [];

  switch (intent) {
    case 'HIGH_RISK_MINES': {
      const ranked = allMines.slice(0, 5);
      result.mines = ranked;
      result.evidence = mineEvidence(ranked);
      result.nextContext = { lastMineIds: ranked.map((m) => m.id), focusedMineId: ranked[0]?.id };
      if (ranked.length === 0) result.notes.push('No mines are visible to this account.');
      break;
    }

    case 'MINE_STATUS':
    case 'MINE_PROFILE': {
      if (targetMineIds.length === 0) {
        result.notes.push('No mine was named or in focus — ask which mine, or say "highest risk mines" first.');
        break;
      }
      const mineId = targetMineIds[0];
      const mine = allMines.find((m) => m.id === mineId);
      if (!mine) {
        result.deniedReason = 'That mine is not accessible with your current role.';
        break;
      }
      const scopedWhere = { mineId };
      const [recentInspections, openViolations, violationsTotal, openAlerts, latestReadings, reportsAgg] = await Promise.all([
        db.inspection.findMany({
          where: scopedWhere,
          orderBy: { scheduledDate: 'desc' },
          take: 5,
          include: { inspector: { select: { name: true } } },
        }),
        db.violation.count({ where: { ...scopedWhere, status: { in: OUTSTANDING_VIOLATION } } }),
        db.violation.count({ where: scopedWhere }),
        db.alert.findMany({ where: { ...scopedWhere, status: { in: OUTSTANDING_ALERT } }, orderBy: { createdAt: 'desc' }, take: 5 }),
        db.environmentalReading.findMany({ where: scopedWhere, orderBy: { createdAt: 'desc' }, take: 5 }),
        can(me.role, 'REPORT_READ')
          ? Promise.all([
              db.report.count({ where: scopedWhere }),
              db.report.count({ where: { ...scopedWhere, status: 'APPROVED' } }),
              db.report.count({ where: { ...scopedWhere, status: 'SUBMITTED' } }),
            ])
          : Promise.resolve(null),
      ]);
      const overdue = recentInspections.filter((i) => i.status === 'OVERDUE').length;
      const exceededReadings = latestReadings.filter((r) => r.exceededAt !== null);

      result.mineDetail = {
        overview: { name: mine.name, code: mine.code, region: mine.region, status: mine.status },
        risk: { complianceScore: mine.complianceScore, band: riskBand(mine.complianceScore) },
        safety: { recentInspections, overdueCount: overdue },
        compliance: reportsAgg
          ? { total: reportsAgg[0], approved: reportsAgg[1], pendingApproval: reportsAgg[2] }
          : null,
        environment: { latestReadings, exceededCount: exceededReadings.length },
        openActions: { overdueInspections: overdue, openAlerts: openAlerts.length, openViolations, violationsTotal },
      };
      result.alerts = openAlerts;
      result.readings = latestReadings;
      result.inspections = recentInspections;
      result.evidence = [
        { label: `${mine.name} (${mine.code})`, type: 'mine', id: mine.id },
        ...recentInspections.map((i) => ({ label: `Inspection #${i.id.slice(-6)}`, type: 'inspection' as const, id: i.id })),
        ...openAlerts.map((a) => ({ label: `Alert #${a.id.slice(-6)}`, type: 'alert' as const, id: a.id })),
      ];
      if (!reportsAgg) result.notes.push(`${me.role} does not have report-read access — compliance report figures are omitted.`);
      result.nextContext = { lastMineIds: [mine.id], focusedMineId: mine.id };
      break;
    }

    case 'EXPLAIN_RISK': {
      let mineId = targetMineIds[0];
      // "why did the AI assign risk score 82" — match a mentioned number
      // against real stored scores (0..1 in the DB, shown to users as 0..100).
      const mentionedScore = entities.mentionedScore;

      const where: Prisma.InspectionWhereInput = {
        riskScore: { not: null },
        ...(mineId ? { mineId } : {}),
        ...(mentionedScore !== undefined ? { riskScore: { gte: mentionedScore - 0.02, lte: mentionedScore + 0.02 } } : {}),
      };
      const inspection = await db.inspection.findFirst({
        where,
        orderBy: { updatedAt: 'desc' },
        include: { mine: { select: MINE_LITE_SELECT }, inspector: { select: { name: true } } },
      });
      if (!inspection) {
        result.notes.push('No AI-scored inspection matches that request yet — a score is only assigned once an inspection runs through AI risk scoring.');
        break;
      }
      if (!mineId) mineId = inspection.mineId;
      const relatedAlert = await db.alert.findFirst({ where: { type: 'HIGH_AI_RISK', inspectionId: inspection.id } });
      result.mineDetail = {
        inspection: {
          id: inspection.id,
          type: inspection.type,
          status: inspection.status,
          scheduledDate: inspection.scheduledDate,
          riskScore: inspection.riskScore,
          riskReasons: inspection.riskReasons,
          summary: inspection.summary,
        },
        mine: inspection.mine,
      };
      result.evidence = [
        { label: `Inspection #${inspection.id.slice(-6)}`, type: 'inspection', id: inspection.id },
        { label: `${inspection.mine.name} (${inspection.mine.code})`, type: 'mine', id: inspection.mineId },
        ...(relatedAlert ? [{ label: `Alert #${relatedAlert.id.slice(-6)}`, type: 'alert' as const, id: relatedAlert.id }] : []),
      ];
      if (relatedAlert) result.alerts = [relatedAlert];
      result.nextContext = { lastMineIds: [inspection.mineId], focusedMineId: inspection.mineId };
      break;
    }

    case 'OVERDUE_INSPECTIONS':
    case 'INSPECTION_HISTORY': {
      const where: Prisma.InspectionWhereInput = {};
      if (me.role === 'FIELD_INSPECTOR') where.inspectorId = me.id;
      if (me.role === 'MINE_OFFICIAL' && me.mineId) where.mineId = me.mineId;
      if (targetMineIds.length > 0) where.mineId = { in: targetMineIds };
      if (intent === 'OVERDUE_INSPECTIONS') where.status = 'OVERDUE';
      else if (entities.inspectionStatus) where.status = entities.inspectionStatus;
      if (entities.timeRangeDays) where.updatedAt = { gte: daysAgo(entities.timeRangeDays) };

      const rows = await db.inspection.findMany({
        where,
        orderBy: { scheduledDate: 'desc' },
        take: 20,
        include: { mine: { select: MINE_LITE_SELECT }, inspector: { select: { name: true } } },
      });
      result.inspections = rows;
      result.evidence = rows.map((i) => ({ label: `Inspection #${i.id.slice(-6)} — ${i.mine.name}`, type: 'inspection', id: i.id }));
      result.nextContext = { lastMineIds: Array.from(new Set(rows.map((r) => r.mineId))).slice(0, 5), focusedMineId: rows[0]?.mineId };
      if (rows.length === 0) result.notes.push('No inspections match that request within the data currently on file.');
      break;
    }

    case 'VIOLATIONS_QUERY': {
      const where: Prisma.ViolationWhereInput = {
        ...(me.role === 'MINE_OFFICIAL' ? mineScopeFilter(me) : {}),
        ...(targetMineIds.length > 0 ? { mineId: { in: targetMineIds } } : {}),
        ...(entities.violationStatus ? { status: entities.violationStatus } : {}),
        ...(entities.violationSeverity ? { severity: entities.violationSeverity } : {}),
        ...(entities.timeRangeDays ? { createdAt: { gte: daysAgo(entities.timeRangeDays) } } : {}),
      };
      let rows = await db.violation.findMany({
        where,
        orderBy: entities.repeated ? { escalationCount: 'desc' } : { createdAt: 'desc' },
        take: 20,
        include: { mine: { select: MINE_LITE_SELECT }, issuedBy: { select: { name: true } } },
      });
      if (entities.repeated) rows = rows.filter((v) => v.escalationCount > 0);
      result.violations = rows;
      result.evidence = rows.map((v) => ({ label: `Violation ${v.code} — ${v.mine?.name ?? 'Unknown mine'}`, type: 'violation', id: v.id }));
      result.nextContext = { lastMineIds: Array.from(new Set(rows.map((r) => r.mineId).filter((id): id is string => Boolean(id)))).slice(0, 5), focusedMineId: rows[0]?.mineId ?? undefined };
      if (rows.length === 0) result.notes.push('No violations match that request within the data currently on file.');
      break;
    }

    case 'ALERTS_QUERY': {
      const where: Prisma.AlertWhereInput = {
        ...(me.role === 'MINE_OFFICIAL' ? mineScopeFilter(me) : {}),
        ...(targetMineIds.length > 0 ? { mineId: { in: targetMineIds } } : {}),
        ...(entities.alertStatus ? { status: entities.alertStatus } : {}),
        ...(entities.alertSeverity ? { severity: entities.alertSeverity } : {}),
        ...(entities.environmentalParameter ? { type: 'ENVIRONMENTAL_THRESHOLD' } : {}),
        ...(entities.timeRangeDays ? { createdAt: { gte: daysAgo(entities.timeRangeDays) } } : {}),
      };
      const rows = await db.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { mine: { select: MINE_LITE_SELECT } },
      });
      result.alerts = rows;
      result.evidence = rows.map((a) => ({ label: `Alert #${a.id.slice(-6)} — ${a.title}`, type: 'alert', id: a.id }));
      result.nextContext = { lastMineIds: Array.from(new Set(rows.map((r) => r.mineId).filter((id): id is string => Boolean(id)))).slice(0, 5), focusedMineId: rows[0]?.mineId ?? undefined };
      if (rows.length === 0) result.notes.push('No alerts match that request within the data currently on file.');
      break;
    }

    case 'ENVIRONMENTAL_QUERY': {
      const where: Prisma.EnvironmentalReadingWhereInput = {
        ...(me.role === 'MINE_OFFICIAL' ? mineScopeFilter(me) : {}),
        ...(targetMineIds.length > 0 ? { mineId: { in: targetMineIds } } : {}),
        ...(entities.timeRangeDays ? { createdAt: { gte: daysAgo(entities.timeRangeDays) } } : {}),
      };
      let rows = await db.environmentalReading.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { mine: { select: MINE_LITE_SELECT } },
      });
      if (entities.environmentalParameter) {
        const needle = entities.environmentalParameter.toLowerCase();
        const filtered = rows.filter((r) => r.parameter.toLowerCase().includes(needle));
        if (filtered.length > 0) rows = filtered;
        else result.notes.push(`No readings tagged "${entities.environmentalParameter}" are on file — showing the most recent environmental readings instead.`);
      }
      rows = rows.slice(0, 15);
      result.readings = rows;
      result.evidence = rows.map((r) => ({ label: `Reading ${r.parameter} — ${r.mine.name}`, type: 'reading', id: r.id }));
      const exceeded = rows.filter((r) => r.exceededAt !== null);
      if (exceeded.length > 0) result.notes.push(`${exceeded.length} of these readings exceeded their threshold.`);
      result.nextContext = { lastMineIds: Array.from(new Set(rows.map((r) => r.mineId))).slice(0, 5), focusedMineId: rows[0]?.mineId };
      if (rows.length === 0) result.notes.push('No environmental readings match that request within the data currently on file.');
      break;
    }

    case 'REPORTS_QUERY':
    case 'GENERATE_REPORT': {
      if (!can(me.role, 'REPORT_READ') && intent === 'REPORTS_QUERY') {
        result.deniedReason = `${me.role} does not have access to reports.`;
        break;
      }
      if (targetMineIds.length === 0 && intent === 'GENERATE_REPORT') {
        result.notes.push('Name a mine to generate its compliance report — e.g. "generate a compliance report for Mine Alpha".');
        break;
      }
      if (intent === 'GENERATE_REPORT') {
        const mine = allMines.find((m) => m.id === targetMineIds[0]);
        if (!mine) {
          result.deniedReason = 'That mine is not accessible with your current role.';
          break;
        }
        if (!can(me.role, 'REPORT_READ')) {
          result.deniedReason = `${me.role} does not have access to compliance reports.`;
          break;
        }
        result.reportAction = { mineId: mine.id, mineName: mine.name };
        result.evidence = [{ label: `${mine.name} (${mine.code})`, type: 'mine', id: mine.id }];
        result.nextContext = { lastMineIds: [mine.id], focusedMineId: mine.id };
      }
      const where: Prisma.ReportWhereInput = {
        ...(me.role === 'MINE_OFFICIAL' ? mineScopeFilter(me) : {}),
        ...(targetMineIds.length > 0 ? { mineId: { in: targetMineIds } } : {}),
        ...(entities.reportStatus ? { status: entities.reportStatus } : {}),
      };
      const rows = await db.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { mine: { select: MINE_LITE_SELECT }, author: { select: { name: true } } },
      });
      result.reports = rows;
      result.evidence = [...result.evidence, ...rows.map((r) => ({ label: `Report "${r.title}" — ${r.mine.name}`, type: 'report' as const, id: r.id }))];
      if (rows.length === 0 && intent === 'REPORTS_QUERY') result.notes.push('No reports match that request within the data currently on file.');
      break;
    }

    case 'COMPLIANCE_SUMMARY': {
      const mineFilter = mineScopeFilter(me);
      const mineSelf = mineSelfFilter(me);
      const [minesTotal, activeMines, inspTotal, inspOverdue, inspCompleted, alertsOpen, alertsCritical, violOpen, violCritical, reportsSubmitted] = await Promise.all([
        db.mine.count({ where: mineSelf }),
        db.mine.count({ where: { ...mineSelf, status: 'ACTIVE' } }),
        db.inspection.count({ where: mineFilter }),
        db.inspection.count({ where: { ...mineFilter, status: 'OVERDUE' } }),
        db.inspection.count({ where: { ...mineFilter, status: 'COMPLETED' } }),
        db.alert.count({ where: { ...mineFilter, status: { in: OUTSTANDING_ALERT } } }),
        db.alert.count({ where: { ...mineFilter, severity: 'CRITICAL', status: { in: OUTSTANDING_ALERT } } }),
        db.violation.count({ where: { ...mineFilter, status: { in: OUTSTANDING_VIOLATION } } }),
        db.violation.count({ where: { ...mineFilter, severity: 'CRITICAL', status: { in: OUTSTANDING_VIOLATION } } }),
        can(me.role, 'REPORT_READ') ? db.report.count({ where: { ...mineFilter, status: 'SUBMITTED' } }) : Promise.resolve(null),
      ]);
      const avgCompliance = allMines.length > 0 ? allMines.reduce((s, m) => s + m.complianceScore, 0) / allMines.length : null;
      result.summary = {
        minesTotal, activeMines, avgCompliance: avgCompliance ?? -1,
        inspectionsTotal: inspTotal, inspectionsOverdue: inspOverdue, inspectionsCompleted: inspCompleted,
        alertsOpen, alertsCritical, violationsOpen: violOpen, violationsCritical: violCritical,
        ...(reportsSubmitted !== null ? { reportsAwaitingApproval: reportsSubmitted } : {}),
      };
      result.mines = allMines.filter((m) => riskBand(m.complianceScore) === 'high').slice(0, 5);
      result.evidence = mineEvidence(result.mines);
      if (reportsSubmitted === null) result.notes.push(`${me.role} does not have report-read access — report figures are omitted.`);
      break;
    }

    case 'SAFETY_TIMELINE': {
      const days = entities.timeRangeDays ?? 30;
      const since = daysAgo(days);
      const mineFilter = mineScopeFilter(me);
      const inspFilter: Prisma.InspectionWhereInput = { ...mineFilter, ...(me.role === 'FIELD_INSPECTOR' ? { inspectorId: me.id } : {}) };
      const [inspectionsCompleted, alertsGenerated, violationsResolved, criticalViolationsResolved] = await Promise.all([
        db.inspection.count({ where: { ...inspFilter, status: 'COMPLETED', completedDate: { gte: since } } }),
        db.alert.count({ where: { ...mineFilter, createdAt: { gte: since } } }),
        db.violation.count({ where: { ...mineFilter, status: 'RECTIFIED', updatedAt: { gte: since } } }),
        db.violation.count({ where: { ...mineFilter, status: 'RECTIFIED', severity: 'CRITICAL', updatedAt: { gte: since } } }),
      ]);
      result.timeline = [
        { label: 'Inspections completed', value: inspectionsCompleted },
        { label: 'Alerts generated', value: alertsGenerated },
        { label: 'Violations resolved', value: violationsResolved },
        { label: 'Critical violations resolved', value: criticalViolationsResolved },
      ];
      result.summary = { windowDays: days };
      // The Mine model stores only the current complianceScore, not a
      // history — a "compliance improved N%" claim would be fabricated.
      result.notes.push('Compliance-score history is not tracked by PRAHARI, so a percentage trend cannot be reported — only the counts above are available for this window.');
      break;
    }

    case 'GENERAL':
    default: {
      // No confident intent: fall back to a light keyword search across
      // accessible mines so the model still has *something* real to ground
      // on if the question named a mine, and is told plainly otherwise.
      if (targetMineIds.length > 0) {
        result.mines = allMines.filter((m) => targetMineIds.includes(m.id));
        result.evidence = mineEvidence(result.mines);
      } else {
        result.notes.push('No specific PRAHARI record matched this question — ask about a mine, inspections, violations, alerts, environmental readings, or reports.');
      }
      break;
    }
  }

  return result;
}
