// GET /api/dashboard/summary
// Role-scoped KPIs:
//   - counts of mines, inspections, alerts, violations, reports
//   - breakdown by status where applicable
//
// MINE_OFFICIAL sees only their mine's numbers; everyone else sees
// cross-mine aggregates.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok } from '@/lib/http';
import { requireRole, type MyRequest, mineScopeFilter, mineSelfFilter } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;
  const mineFilter = mineScopeFilter(me); // { mineId?: string } — for child entities
  const mineSelf = mineSelfFilter(me);     // { id?: string } — for the Mine model itself

  const [
    minesTotal,
    activeMines,
    inspectionsTotal,
    overdueInspections,
    completedInspections,
    alertsTotal,
    openAlerts,
    criticalAlerts,
    violationsTotal,
    openViolations,
    criticalViolations,
    reportsTotal,
    submittedReports,
    approvedReports,
  ] = await Promise.all([
    db.mine.count({ where: mineSelf }),
    db.mine.count({ where: { ...mineSelf, status: 'ACTIVE' } }),
    db.inspection.count({ where: mineFilter }),
    db.inspection.count({ where: { ...mineFilter, status: 'OVERDUE' } }),
    db.inspection.count({ where: { ...mineFilter, status: 'COMPLETED' } }),
    db.alert.count({ where: mineFilter }),
    db.alert.count({ where: { ...mineFilter, status: 'OPEN' } }),
    db.alert.count({ where: { ...mineFilter, severity: 'CRITICAL', status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }),
    db.violation.count({ where: mineFilter }),
    db.violation.count({ where: { ...mineFilter, status: 'OPEN' } }),
    db.violation.count({ where: { ...mineFilter, severity: 'CRITICAL', status: { in: ['OPEN', 'NOTIFIED', 'ESCALATED'] } } }),
    db.report.count({ where: mineFilter }),
    db.report.count({ where: { ...mineFilter, status: 'SUBMITTED' } }),
    db.report.count({ where: { ...mineFilter, status: 'APPROVED' } }),
  ]);

  return ok({
    mines: { total: minesTotal, active: activeMines },
    inspections: { total: inspectionsTotal, overdue: overdueInspections, completed: completedInspections },
    alerts: { total: alertsTotal, open: openAlerts, critical: criticalAlerts },
    violations: { total: violationsTotal, open: openViolations, critical: criticalViolations },
    reports: { total: reportsTotal, submitted: submittedReports, approved: approvedReports },
  });
}
