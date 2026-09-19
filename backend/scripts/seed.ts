// Idempotent seed script. Run with: `bun run scripts/seed.ts`
//
// Creates:
//   - the original 2 demo mines (Alpha, Beta) and their sample records
//   - 4 demo users (one per role)
//   - a curated portfolio of 8 further fictional mines (scripts/demo-dataset.ts)
//     with inspections, violations, reports, environmental readings, and alerts
// then runs the escalation workflow so the data produces real alerts.
//
// After running the seed you can login with any of the demo users via
// `POST /api/auth/login` and explore the API through the Swagger UI at
// `/api-docs`.
//
// Works against either database DATABASE_URL points at (see
// src/lib/database-url.ts): embedded PGlite for local development, or a real
// PostgreSQL server (the Docker stack) whose schema `prisma db push` manages.

import { resolve } from 'node:path';
import { createPgliteAdapter } from 'prisma-pglite';
import { isPostgresUrl, pgliteParentDir } from '../src/lib/database-url';
import { DEMO_MINES, daysFromNow } from './demo-dataset';

// STEP 1: ensure the schema exists.
if (isPostgresUrl(process.env.DATABASE_URL)) {
  console.log('[seed] PostgreSQL detected — schema is managed by `prisma db push`.');
} else {
  // PGlite: push the schema with `createPgliteAdapter` from `prisma-pglite`,
  // then dispose of that instance so the runtime db module can open the
  // existing database directly (without the schema push step).
  console.log('[seed] pushing schema to PGlite (idempotent)...');
  const adapter = await createPgliteAdapter({
    dbParentDirPath: pgliteParentDir(process.env.DATABASE_URL),
    prismaConfigPath: resolve(process.cwd(), 'prisma.config.ts'),
  });
  // Dispose the PGlite instance — the database file is now persisted with
  // the schema. The next imports will re-open it via the lighter-weight
  // direct PGlite open in src/lib/db.ts.
  try { (adapter as unknown as { pgliteClient?: { close?: () => Promise<void> } }).pgliteClient?.close?.(); } catch {}
  // Give the filesystem a moment to flush.
  await new Promise(r => setTimeout(r, 200));
  console.log('[seed] schema ready.');
}

// STEP 2: now import the runtime db + helper modules. With PGlite they
// re-open the same directory, which now has the schema.
const { db } = await import('../src/lib/db');
const { hashPassword } = await import('../src/lib/auth/password');
const { runAllTriggers } = await import('../src/lib/workflow/triggers');

async function main() {
  console.log('[seed] starting...');

  // Mines -------------------------------------------------------------
  const mineA = await db.mine.upsert({
    where: { code: 'DEMO-MINE-001' },
    update: {},
    create: { name: 'Demo Mine Alpha', code: 'DEMO-MINE-001', location: 'Sector 7', region: 'North', status: 'ACTIVE', complianceScore: 87.5 },
  });
  const mineB = await db.mine.upsert({
    where: { code: 'DEMO-MINE-002' },
    update: {},
    create: { name: 'Demo Mine Beta', code: 'DEMO-MINE-002', location: 'Sector 3', region: 'South', status: 'ACTIVE', complianceScore: 72.1 },
  });
  console.log('[seed] mines:', mineA.code, mineB.code);

  // Users -------------------------------------------------------------
  const users = [
    { email: 'inspector@demo.local', name: 'Inspector Demo', role: 'FIELD_INSPECTOR' as const, mineId: null as string | null, password: 'demo12345' },
    { email: 'official@demo.local', name: 'Mine Official Demo', role: 'MINE_OFFICIAL' as const, mineId: mineA.id as string | null, password: 'demo12345' },
    { email: 'corporate@demo.local', name: 'Corporate Admin Demo', role: 'CORPORATE_ADMIN' as const, mineId: null as string | null, password: 'demo12345' },
    { email: 'regulator@demo.local', name: 'Regulator Demo', role: 'REGULATOR' as const, mineId: null as string | null, password: 'demo12345' },
  ];
  const createdUsers: { id: string; email: string; role: string }[] = [];
  for (const u of users) {
    const existing = await db.user.findUnique({ where: { email: u.email } });
    if (existing) {
      createdUsers.push(existing);
      continue;
    }
    const passwordHash = await hashPassword(u.password);
    const created = await db.user.create({ data: { email: u.email, name: u.name, role: u.role, mineId: u.mineId, passwordHash } });
    createdUsers.push(created);
  }
  console.log('[seed] users:', createdUsers.map(u => u.email).join(', '));

  const inspector = createdUsers.find(u => u.role === 'FIELD_INSPECTOR')!;
  const official = createdUsers.find(u => u.role === 'MINE_OFFICIAL')!;
  const corporate = createdUsers.find(u => u.role === 'CORPORATE_ADMIN')!;

  // Inspections -------------------------------------------------------
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  await db.inspection.upsert({
    where: { id: 'demo-insp-1' },
    update: {},
    create: {
      id: 'demo-insp-1',
      mineId: mineA.id,
      inspectorId: inspector.id,
      type: 'SAFETY',
      status: 'COMPLETED',
      scheduledDate: oneWeekAgo,
      completedDate: twoDaysAgo,
      summary: 'Routine safety inspection. Minor issues: dust level slightly elevated near vent shaft. Fire extinguisher missing in building C. Recommendations: replace extinguisher, install dust monitor.',
      findings: { violations: ['missing-extinguisher', 'dust-elevated'], deficiencies: ['no-monitor-in-vent-shaft'] },
      riskScore: 0.62,
      riskReasons: ['2 issue(s) recorded in findings', 'Moderate keyword matched: "dust"'],
    },
  });
  await db.inspection.upsert({
    where: { id: 'demo-insp-2' },
    update: {},
    create: {
      id: 'demo-insp-2',
      mineId: mineB.id,
      inspectorId: inspector.id,
      type: 'ENVIRONMENTAL',
      status: 'SCHEDULED',
      scheduledDate: inThreeDays,
      summary: 'Upcoming environmental compliance review.',
    },
  });
  await db.inspection.upsert({
    where: { id: 'demo-insp-3' },
    update: {},
    create: {
      id: 'demo-insp-3',
      mineId: mineB.id,
      inspectorId: inspector.id,
      type: 'COMPLIANCE',
      status: 'SCHEDULED',
      scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // already overdue!
      summary: 'Compliance audit (will be flagged as overdue by workflow).',
    },
  });
  console.log('[seed] inspections created');

  // Violations --------------------------------------------------------
  await db.violation.upsert({
    where: { id: 'demo-viol-1' },
    update: {},
    create: {
      id: 'demo-viol-1',
      mineId: mineA.id,
      inspectionId: 'demo-insp-1',
      issuedById: inspector.id,
      severity: 'MINOR',
      status: 'OPEN',
      code: 'SAF-001',
      description: 'Missing fire extinguisher in building C.',
      penaltyAmount: 500,
    },
  });
  await db.violation.upsert({
    where: { id: 'demo-viol-2' },
    update: {},
    create: {
      id: 'demo-viol-2',
      mineId: mineA.id,
      inspectionId: 'demo-insp-1',
      issuedById: inspector.id,
      severity: 'MAJOR',
      status: 'OPEN',
      code: 'SAF-002',
      description: 'Elevated dust levels near vent shaft.',
      penaltyAmount: 1500,
    },
  });
  await db.violation.upsert({
    where: { id: 'demo-viol-3' },
    update: {},
    create: {
      id: 'demo-viol-3',
      mineId: mineA.id,
      issuedById: corporate.id,
      severity: 'MINOR',
      status: 'OPEN',
      code: 'SAF-003',
      description: 'Documented training records incomplete.',
      penaltyAmount: 250,
    },
  });
  console.log('[seed] violations created');

  // Reports -----------------------------------------------------------
  await db.report.upsert({
    where: { id: 'demo-report-1' },
    update: {},
    create: {
      id: 'demo-report-1',
      mineId: mineB.id,
      authorId: official.id,
      type: 'MONTHLY',
      status: 'DRAFT',
      title: 'Monthly compliance report — Demo Mine Beta',
      body: 'This is a placeholder report. The mine has not yet submitted any monthly report in the last 30 days — the missing-report workflow trigger will flag this.',
      periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(),
    },
  });
  console.log('[seed] reports created');

  // Environmental readings --------------------------------------------
  await db.environmentalReading.upsert({
    where: { id: 'demo-env-1' },
    update: {},
    create: {
      id: 'demo-env-1',
      mineId: mineA.id,
      parameter: 'PM2_5',
      value: 42,
      unit: 'ug/m3',
      threshold: 35,
    },
  });
  console.log('[seed] environmental readings created');

  // Manual alert ------------------------------------------------------
  await db.alert.upsert({
    where: { id: 'demo-alert-1' },
    update: {},
    create: {
      id: 'demo-alert-1',
      type: 'MANUAL',
      severity: 'LOW',
      status: 'OPEN',
      title: 'Demo manual alert',
      message: 'A pre-seeded manual alert so the Alerts API returns something useful out of the box.',
      mineId: mineA.id,
    },
  });
  console.log('[seed] manual alert created');

  // Curated demo portfolio --------------------------------------------
  // Upserts keyed on fixed codes/ids, so re-running the seed is a no-op.
  // Violations are issued by the field inspector and reports authored by
  // the corporate admin — both roles the RBAC matrix allows to do so for
  // any mine (the demo mine official is scoped to Demo Mine Alpha only).
  for (const m of DEMO_MINES) {
    const mine = await db.mine.upsert({
      where: { code: m.code },
      update: {},
      create: {
        name: m.name,
        code: m.code,
        location: m.location,
        region: m.region,
        status: m.status,
        complianceScore: m.complianceScore,
      },
    });

    for (const i of m.inspections) {
      await db.inspection.upsert({
        where: { id: i.id },
        update: {},
        create: {
          id: i.id,
          mineId: mine.id,
          inspectorId: inspector.id,
          type: i.type,
          status: i.status,
          scheduledDate: daysFromNow(i.scheduledInDays),
          completedDate: i.completedInDays === undefined ? null : daysFromNow(i.completedInDays),
          summary: i.summary,
          riskScore: i.riskScore ?? null,
          riskReasons: i.riskReasons ?? [],
        },
      });
    }

    for (const v of m.violations) {
      await db.violation.upsert({
        where: { id: v.id },
        update: {},
        create: {
          id: v.id,
          mineId: mine.id,
          inspectionId: v.inspectionId ?? null,
          issuedById: inspector.id,
          severity: v.severity,
          status: v.status,
          code: v.code,
          description: v.description,
          penaltyAmount: v.penaltyAmount,
          createdAt: daysFromNow(v.createdInDays),
          rectifiedAt: v.rectifiedInDays === undefined ? null : daysFromNow(v.rectifiedInDays),
          escalatedAt: v.escalatedInDays === undefined ? null : daysFromNow(v.escalatedInDays),
          escalationCount: v.escalationCount ?? 0,
        },
      });
    }

    for (const r of m.reports) {
      await db.report.upsert({
        where: { id: r.id },
        update: {},
        create: {
          id: r.id,
          mineId: mine.id,
          authorId: corporate.id,
          type: r.type,
          status: r.status,
          title: r.title,
          body: r.body,
          periodStart: daysFromNow(r.periodStartInDays),
          periodEnd: daysFromNow(r.periodEndInDays),
          submittedAt: r.submittedInDays === undefined ? null : daysFromNow(r.submittedInDays),
          approvedAt: r.approvedInDays === undefined ? null : daysFromNow(r.approvedInDays),
        },
      });
    }

    for (const reading of m.readings) {
      await db.environmentalReading.upsert({
        where: { id: reading.id },
        update: {},
        create: {
          id: reading.id,
          mineId: mine.id,
          parameter: reading.parameter,
          value: reading.value,
          unit: reading.unit,
          threshold: reading.threshold ?? null,
          createdAt: daysFromNow(reading.recordedInDays),
        },
      });
    }

    for (const a of m.alerts) {
      await db.alert.upsert({
        where: { id: a.id },
        update: {},
        create: {
          id: a.id,
          type: 'MANUAL',
          severity: a.severity,
          status: a.status,
          title: a.title,
          message: a.message,
          mineId: mine.id,
          createdAt: daysFromNow(a.createdInDays),
          resolvedAt: a.resolvedInDays === undefined ? null : daysFromNow(a.resolvedInDays),
        },
      });
    }
  }
  console.log(`[seed] demo portfolio: ${DEMO_MINES.map(m => m.code).join(', ')}`);

  // Run the workflow triggers so the seeded data produces real alerts -
  // inspection overdue, repeated violations, missing report, environmental
  // threshold crossed.
  console.log('[seed] running workflow triggers...');
  const triggered = await runAllTriggers();
  for (const t of triggered) {
    console.log(`  ${t.type}: ${t.count} alert(s) created`);
  }

  console.log('[seed] done.');
}

main().catch(err => {
  console.error('[seed] FATAL:', err);
  process.exit(1);
});
