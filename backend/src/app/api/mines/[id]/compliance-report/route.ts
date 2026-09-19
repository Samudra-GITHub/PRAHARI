// GET /api/mines/[id]/compliance-report
// Streams a statutory compliance report PDF for one mine.
//
// Access mirrors REPORT_READ in src/lib/rbac.ts: MINE_OFFICIAL (own mine
// only), CORPORATE_ADMIN, REGULATOR. FIELD_INSPECTOR gets 403 — same as the
// existing /api/reports routes. Every export is written to the audit chain.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { notFound, forbidden } from '@/lib/http';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { buildCompliancePdf } from '@/lib/reports/compliance-pdf';
import type { AlertStatus, ViolationStatus } from '@/generated/prisma/client';

type Ctx = { params: Promise<{ id: string }> };

// Keeps a single export bounded; the PDF states when older rows were omitted.
const ROW_LIMIT = 250;

const OUTSTANDING_VIOLATION: ViolationStatus[] = ['OPEN', 'NOTIFIED', 'ESCALATED'];
const OUTSTANDING_ALERT: AlertStatus[] = ['OPEN', 'ACKNOWLEDGED'];

function capped<T>(rows: T[]): { rows: T[]; truncated: boolean } {
  return rows.length > ROW_LIMIT ? { rows: rows.slice(0, ROW_LIMIT), truncated: true } : { rows, truncated: false };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireRole(req, ['MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;

  const mine = await db.mine.findUnique({ where: { id } });
  if (!mine) return notFound('Mine not found');
  if (me.role === 'MINE_OFFICIAL' && mine.id !== me.mineId) {
    return forbidden('You can only export compliance reports for your own mine');
  }

  const where = { mineId: mine.id };
  const take = ROW_LIMIT + 1;

  const [
    inspections,
    violations,
    alerts,
    readings,
    inspectionsTotal,
    inspectionsOverdue,
    inspectionsCompleted,
    violationsTotal,
    violationsOutstanding,
    violationsCritical,
    alertsTotal,
    alertsOutstanding,
    alertsCritical,
    penalties,
  ] = await Promise.all([
    db.inspection.findMany({
      where,
      orderBy: { scheduledDate: 'desc' },
      take,
      include: { inspector: { select: { name: true } } },
    }),
    db.violation.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
    db.alert.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
    db.environmentalReading.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
    // "Outstanding" uses the unresolved-status sets that /api/dashboard/summary
    // applies to its critical counts, so each summary box agrees with the
    // tables printed in the report.
    db.inspection.count({ where }),
    db.inspection.count({ where: { ...where, status: 'OVERDUE' } }),
    db.inspection.count({ where: { ...where, status: 'COMPLETED' } }),
    db.violation.count({ where }),
    db.violation.count({ where: { ...where, status: { in: OUTSTANDING_VIOLATION } } }),
    db.violation.count({ where: { ...where, severity: 'CRITICAL', status: { in: OUTSTANDING_VIOLATION } } }),
    db.alert.count({ where }),
    db.alert.count({ where: { ...where, status: { in: OUTSTANDING_ALERT } } }),
    db.alert.count({ where: { ...where, severity: 'CRITICAL', status: { in: OUTSTANDING_ALERT } } }),
    db.violation.aggregate({ where, _sum: { penaltyAmount: true } }),
  ]);

  const insp = capped(inspections);
  const viol = capped(violations);
  const alrt = capped(alerts);
  const read = capped(readings);
  const generatedAt = new Date();

  const pdf = await buildCompliancePdf({
    mine,
    summary: {
      inspections: { total: inspectionsTotal, overdue: inspectionsOverdue, completed: inspectionsCompleted },
      violations: { total: violationsTotal, outstanding: violationsOutstanding, critical: violationsCritical },
      alerts: { total: alertsTotal, outstanding: alertsOutstanding, critical: alertsCritical },
      penaltiesTotal: penalties._sum.penaltyAmount ?? 0,
    },
    inspections: insp.rows,
    violations: viol.rows,
    alerts: alrt.rows,
    readings: read.rows,
    truncated: {
      inspections: insp.truncated,
      violations: viol.truncated,
      alerts: alrt.truncated,
      readings: read.truncated,
    },
    rowLimit: ROW_LIMIT,
    requestedBy: { name: me.name, role: me.role },
    generatedAt,
  });

  await audit({
    actorId: me.id,
    action: 'COMPLIANCE_REPORT_EXPORT',
    resource: 'Mine',
    resourceId: mine.id,
    payload: { code: mine.code, generatedAt: generatedAt.toISOString() },
  });

  // Mine codes are admin-controlled, but never trust them inside a header.
  const safeCode = mine.code.replace(/[^A-Za-z0-9_-]/g, '_');
  const filename = `PRAHARI_${safeCode}_compliance_report.pdf`;

  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'content-length': String(pdf.byteLength),
      'cache-control': 'no-store',
    },
  });
}
