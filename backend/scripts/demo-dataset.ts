// Curated demo portfolio for scripts/seed.ts.
//
// Adapted from the synthetic-data approach in Jeevan's infra prototype
// (prahari-backend/backend/app/seed.py): roughly ten mines, with a few
// deliberately "planted" high-risk sites so the escalation workflow and AI
// risk features have something obvious to act on. Unlike that prototype this
// data is deterministic (no Faker, no randomness) and shaped to PRAHARI's
// Prisma schema, so every seeded dashboard is identical and explainable.
//
// Every mine here is FICTIONAL. They sit in real Indian coalfield districts
// for realism, but each name contains "Demo" and each code starts "DEMO-", so
// no real colliery is ever associated with fabricated scores or violations.
//
// Dates are expressed as day offsets from "now" so the data never goes stale:
// overdue inspections stay overdue and recent violations stay inside the
// 90-day repeated-violations window whenever the seed runs.

import type {
  AlertSeverity,
  AlertStatus,
  InspectionStatus,
  InspectionType,
  ReportStatus,
  ReportType,
  ViolationSeverity,
  ViolationStatus,
} from '../src/generated/prisma/enums';

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

export type DemoMine = {
  code: string;
  name: string;
  location: string;
  region: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  complianceScore: number;
  inspections: {
    id: string;
    type: InspectionType;
    status: InspectionStatus;
    scheduledInDays: number;
    completedInDays?: number;
    summary: string;
    riskScore?: number;
    riskReasons?: string[];
  }[];
  violations: {
    id: string;
    code: string;
    severity: ViolationSeverity;
    status: ViolationStatus;
    description: string;
    penaltyAmount: number;
    createdInDays: number;
    inspectionId?: string;
    rectifiedInDays?: number;
    escalatedInDays?: number;
    escalationCount?: number;
  }[];
  reports: {
    id: string;
    type: ReportType;
    status: ReportStatus;
    title: string;
    body: string;
    periodStartInDays: number;
    periodEndInDays: number;
    submittedInDays?: number;
    approvedInDays?: number;
  }[];
  readings: {
    id: string;
    parameter: string;
    value: number;
    unit: string;
    threshold?: number;
    recordedInDays: number;
  }[];
  alerts: {
    id: string;
    severity: AlertSeverity;
    status: AlertStatus;
    title: string;
    message: string;
    createdInDays: number;
    resolvedInDays?: number;
  }[];
};

// Resulting portfolio (with the original Alpha/Beta demo mines):
//   high risk   (<60):  Jharia 54.2, Talcher 47.8, Wardha 38.5
//   medium risk (<85):  Beta 72.1, Raniganj 81.3, Godavari 69.4, Mahanadi 76.0
//   low risk    (>=85): Alpha 87.5, Korba 91.6, Singrauli 88.9
export const DEMO_MINES: DemoMine[] = [
  {
    code: 'DEMO-MINE-003',
    name: 'Jharia Demo Colliery',
    location: 'Dhanbad, Jharkhand',
    region: 'East',
    status: 'ACTIVE',
    complianceScore: 54.2,
    inspections: [
      {
        id: 'demo-insp-j1',
        type: 'SAFETY',
        status: 'COMPLETED',
        scheduledInDays: -14,
        completedInDays: -13,
        summary:
          'Statutory safety inspection of underground workings, District 3. Methane recorded above the permissible limit at the return airway; main mechanical ventilator operating below the approved quantity.',
        riskScore: 0.86,
        riskReasons: ['Methane above permissible limit at District 3 return airway', 'Ventilation quantity below approved plan'],
      },
      {
        id: 'demo-insp-j2',
        type: 'ENVIRONMENTAL',
        status: 'SCHEDULED',
        scheduledInDays: -4, // flagged overdue by the workflow
        summary: 'Quarterly air and water quality monitoring.',
      },
    ],
    // Three violations inside 90 days trips the repeated-violations trigger.
    violations: [
      {
        id: 'demo-viol-j1',
        code: 'GAS-007',
        severity: 'CRITICAL',
        status: 'ESCALATED',
        description:
          'Methane concentration of 1.4% recorded at the District 3 return airway; electrical power was not cut off as required.',
        penaltyAmount: 500000,
        createdInDays: -13,
        inspectionId: 'demo-insp-j1',
        escalatedInDays: -10,
        escalationCount: 1,
      },
      {
        id: 'demo-viol-j2',
        code: 'VEN-014',
        severity: 'MAJOR',
        status: 'OPEN',
        description: 'Main mechanical ventilator delivering an air quantity below the approved ventilation plan.',
        penaltyAmount: 200000,
        createdInDays: -13,
        inspectionId: 'demo-insp-j1',
      },
      {
        id: 'demo-viol-j3',
        code: 'EXP-003',
        severity: 'MINOR',
        status: 'NOTIFIED',
        description: "Shot-firer's register not maintained for the preceding two shifts.",
        penaltyAmount: 25000,
        createdInDays: -40,
      },
    ],
    reports: [
      {
        id: 'demo-report-j1',
        type: 'INCIDENT',
        status: 'DRAFT', // not submitted, so the missing-report trigger fires
        title: 'Incident report — methane exceedance, District 3',
        body: 'Draft incident report pending root-cause analysis of the methane exceedance recorded during the statutory safety inspection.',
        periodStartInDays: -14,
        periodEndInDays: -13,
      },
    ],
    readings: [{ id: 'demo-env-j1', parameter: 'PM10', value: 172, unit: 'ug/m3', threshold: 150, recordedInDays: -3 }],
    alerts: [],
  },
  {
    code: 'DEMO-MINE-004',
    name: 'Raniganj Demo Colliery',
    location: 'Asansol, West Bengal',
    region: 'East',
    status: 'ACTIVE',
    complianceScore: 81.3,
    inspections: [
      {
        id: 'demo-insp-r1',
        type: 'ENVIRONMENTAL',
        status: 'COMPLETED',
        scheduledInDays: -21,
        completedInDays: -20,
        summary: 'Environmental inspection of the coal handling plant. Dust suppression partially non-functional; since rectified.',
        riskScore: 0.41,
        riskReasons: ['Dust suppression partially non-functional'],
      },
    ],
    violations: [
      {
        id: 'demo-viol-r1',
        code: 'DST-011',
        severity: 'MINOR',
        status: 'RECTIFIED',
        description: 'Dust suppression sprinklers non-functional on the coal handling plant conveyor.',
        penaltyAmount: 50000,
        createdInDays: -20,
        inspectionId: 'demo-insp-r1',
        rectifiedInDays: -12,
      },
    ],
    reports: [
      {
        id: 'demo-report-r1',
        type: 'MONTHLY',
        status: 'SUBMITTED',
        title: 'Monthly compliance return',
        body: 'Monthly statutory return covering production, safety incidents, and environmental monitoring.',
        periodStartInDays: -35,
        periodEndInDays: -5,
        submittedInDays: -3,
      },
    ],
    readings: [{ id: 'demo-env-r1', parameter: 'PM2_5', value: 31, unit: 'ug/m3', threshold: 35, recordedInDays: -2 }],
    alerts: [],
  },
  {
    code: 'DEMO-MINE-005',
    name: 'Korba Demo OCP',
    location: 'Korba, Chhattisgarh',
    region: 'Central',
    status: 'ACTIVE',
    complianceScore: 91.6,
    inspections: [
      {
        id: 'demo-insp-k1',
        type: 'COMPLIANCE',
        status: 'COMPLETED',
        scheduledInDays: -10,
        completedInDays: -9,
        summary: 'Annual statutory compliance audit. All returns filed; no material deficiencies found.',
        riskScore: 0.18,
      },
      {
        id: 'demo-insp-k2',
        type: 'SAFETY',
        status: 'SCHEDULED',
        scheduledInDays: 6,
        summary: 'Blasting-zone safety inspection.',
      },
    ],
    violations: [],
    reports: [
      {
        id: 'demo-report-k1',
        type: 'MONTHLY',
        status: 'APPROVED',
        title: 'Monthly compliance return',
        body: 'Monthly statutory return covering production, safety incidents, and environmental monitoring.',
        periodStartInDays: -31,
        periodEndInDays: -1,
        submittedInDays: -2,
        approvedInDays: -1,
      },
    ],
    readings: [{ id: 'demo-env-k1', parameter: 'NOISE_DB', value: 78, unit: 'dB', threshold: 85, recordedInDays: -1 }],
    alerts: [
      {
        id: 'demo-alert-k1',
        severity: 'LOW',
        status: 'RESOLVED',
        title: 'Mock evacuation drill completed',
        message: 'Scheduled mock evacuation drill completed; all personnel accounted for within the target time.',
        createdInDays: -8,
        resolvedInDays: -5,
      },
    ],
  },
  {
    code: 'DEMO-MINE-006',
    name: 'Talcher Demo OCP',
    location: 'Angul, Odisha',
    region: 'East',
    status: 'ACTIVE',
    complianceScore: 47.8,
    inspections: [
      {
        id: 'demo-insp-t1',
        type: 'EQUIPMENT',
        status: 'COMPLETED',
        scheduledInDays: -7,
        completedInDays: -6,
        summary:
          'Heavy earth-moving machinery and haul road inspection. Unsafe haul road gradient and an unbenched overburden dump observed near an active haul road.',
        // >= 0.95 makes the workflow raise this as a CRITICAL alert.
        riskScore: 0.96,
        riskReasons: ['Haul road gradient steeper than permitted on Bench 4', 'Overburden dump without benching near active haul road'],
      },
      {
        id: 'demo-insp-t2',
        type: 'SAFETY',
        status: 'SCHEDULED',
        scheduledInDays: -10, // flagged overdue by the workflow
        summary: 'Slope stability inspection.',
      },
    ],
    violations: [
      {
        id: 'demo-viol-t1',
        code: 'HAU-022',
        severity: 'MAJOR',
        status: 'OPEN',
        description: 'Haul road gradient on Bench 4 exceeds the permitted 1 in 16.',
        penaltyAmount: 150000,
        createdInDays: -6,
        inspectionId: 'demo-insp-t1',
      },
      {
        id: 'demo-viol-t2',
        code: 'SLP-009',
        severity: 'CRITICAL',
        status: 'OPEN',
        description: 'Overburden dump raised without benching adjacent to an active haul road; risk of slope failure.',
        penaltyAmount: 400000,
        createdInDays: -6,
        inspectionId: 'demo-insp-t1',
      },
    ],
    reports: [],
    // `_MIN` parameters alert when the value falls BELOW the threshold.
    readings: [{ id: 'demo-env-t1', parameter: 'WATER_PH_MIN', value: 5.8, unit: 'pH', threshold: 6.5, recordedInDays: -2 }],
    alerts: [],
  },
  {
    code: 'DEMO-MINE-007',
    name: 'Singrauli Demo OCP',
    location: 'Singrauli, Madhya Pradesh',
    region: 'Central',
    status: 'ACTIVE',
    complianceScore: 88.9,
    inspections: [
      {
        id: 'demo-insp-s1',
        type: 'ROUTINE',
        status: 'COMPLETED',
        scheduledInDays: -16,
        completedInDays: -15,
        summary: 'Routine inspection of mining operations and statutory registers. Satisfactory.',
        riskScore: 0.22,
      },
    ],
    violations: [],
    reports: [
      {
        id: 'demo-report-s1',
        type: 'QUARTERLY',
        status: 'APPROVED',
        title: 'Quarterly compliance return',
        body: 'Quarterly statutory return covering production, safety, and environmental compliance.',
        periodStartInDays: -95,
        periodEndInDays: -5,
        submittedInDays: -4,
        approvedInDays: -2,
      },
    ],
    readings: [{ id: 'demo-env-s1', parameter: 'PM2_5', value: 29, unit: 'ug/m3', threshold: 35, recordedInDays: -4 }],
    alerts: [],
  },
  {
    code: 'DEMO-MINE-008',
    name: 'Godavari Demo UG Mine',
    location: 'Ramagundam, Telangana',
    region: 'South',
    status: 'ACTIVE',
    complianceScore: 69.4,
    inspections: [
      {
        id: 'demo-insp-g1',
        type: 'SAFETY',
        status: 'COMPLETED',
        scheduledInDays: -25,
        completedInDays: -24,
        summary: 'Underground safety inspection. Gas monitoring functional; self-rescuer maintenance records overdue.',
        riskScore: 0.58,
        riskReasons: ['Self-rescuer inspection records overdue'],
      },
      {
        id: 'demo-insp-g2',
        type: 'EQUIPMENT',
        status: 'SCHEDULED',
        scheduledInDays: 2,
        summary: 'Winding engine and man-riding system inspection.',
      },
    ],
    violations: [
      {
        id: 'demo-viol-g1',
        code: 'SRV-004',
        severity: 'MAJOR',
        status: 'OPEN',
        description: 'Self-contained self-rescuer inspection records not updated for the last quarter.',
        penaltyAmount: 100000,
        createdInDays: -24,
        inspectionId: 'demo-insp-g1',
      },
    ],
    reports: [
      {
        id: 'demo-report-g1',
        type: 'MONTHLY',
        status: 'REJECTED', // rejected and outside the 30-day window
        title: 'Monthly compliance return',
        body: 'Monthly statutory return returned for correction: production figures did not reconcile with dispatch records.',
        periodStartInDays: -62,
        periodEndInDays: -32,
        submittedInDays: -30,
      },
    ],
    readings: [],
    alerts: [],
  },
  {
    code: 'DEMO-MINE-009',
    name: 'Wardha Demo OCP',
    location: 'Chandrapur, Maharashtra',
    region: 'West',
    status: 'SUSPENDED',
    complianceScore: 38.5,
    inspections: [
      {
        id: 'demo-insp-w1',
        type: 'COMPLIANCE',
        status: 'COMPLETED',
        scheduledInDays: -45,
        completedInDays: -44,
        summary: 'Compliance audit following the suspension order. Evidence of extraction beyond the approved mining plan boundary.',
        riskScore: 0.74,
        riskReasons: ['Extraction beyond approved mining plan boundary'],
      },
    ],
    violations: [
      {
        id: 'demo-viol-w1',
        code: 'PLN-002',
        severity: 'CRITICAL',
        status: 'ESCALATED',
        description: 'Extraction carried out beyond the boundary of the approved mining plan.',
        penaltyAmount: 1000000,
        createdInDays: -44,
        inspectionId: 'demo-insp-w1',
        escalatedInDays: -30,
        escalationCount: 2,
      },
    ],
    reports: [],
    readings: [],
    alerts: [],
  },
  {
    code: 'DEMO-MINE-010',
    name: 'Mahanadi Demo Colliery',
    location: 'Jharsuguda, Odisha',
    region: 'East',
    status: 'ACTIVE',
    complianceScore: 76.0,
    inspections: [
      {
        id: 'demo-insp-m1',
        type: 'ENVIRONMENTAL',
        status: 'SCHEDULED',
        scheduledInDays: 3,
        summary: 'Pre-monsoon mine water discharge sampling.',
      },
      {
        id: 'demo-insp-m2',
        type: 'ROUTINE',
        status: 'COMPLETED',
        scheduledInDays: -33,
        completedInDays: -32,
        summary: 'Routine inspection. Minor housekeeping deficiencies in the vehicle workshop.',
        riskScore: 0.35,
      },
    ],
    violations: [
      {
        id: 'demo-viol-m1',
        code: 'HSK-006',
        severity: 'MINOR',
        status: 'OPEN',
        description: 'Oil and grease spillage not contained in the vehicle workshop.',
        penaltyAmount: 20000,
        createdInDays: -32,
        inspectionId: 'demo-insp-m2',
      },
    ],
    reports: [
      {
        id: 'demo-report-m1',
        type: 'MONTHLY',
        status: 'SUBMITTED',
        title: 'Monthly compliance return',
        body: 'Monthly statutory return covering production, safety incidents, and environmental monitoring.',
        periodStartInDays: -33,
        periodEndInDays: -3,
        submittedInDays: -2,
      },
    ],
    readings: [{ id: 'demo-env-m1', parameter: 'NOISE_DB', value: 91, unit: 'dB', threshold: 85, recordedInDays: -1 }],
    alerts: [],
  },
];
