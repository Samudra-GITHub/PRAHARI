// Domain model types mirroring the Prisma models in
// backend/prisma/schema.prisma and the exact JSON shapes returned by
// backend/src/app/api/**/route.ts (verified against source, not the OpenAPI
// spec alone — some routes `include` relations and some don't).
//
// Dates are ISO-8601 strings as they come over JSON (not Date instances).

import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  InspectionStatus,
  InspectionType,
  MineStatus,
  ReportStatus,
  ReportType,
  Role,
  ViolationSeverity,
  ViolationStatus,
} from './enums';

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

// Shape returned by /api/auth/login, /api/auth/refresh, /api/auth/me,
// /api/auth/register — every route hand-picks these exact fields (never
// includes passwordHash).
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  mineId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// Minimal user reference embedded in other resources (e.g. Inspection.inspector).
export type UserRef = { id: string; name: string; email: string };
export type UserRefWithRole = { id: string; name: string; email: string; role: Role };

// ---------------------------------------------------------------------------
// Mine
// ---------------------------------------------------------------------------

export type Mine = {
  id: string;
  name: string;
  code: string;
  location: string;
  region: string | null;
  status: MineStatus;
  complianceScore: number;
  createdAt: string;
  updatedAt: string;
};

// Minimal mine reference embedded in other resources.
export type MineRef = { id: string; name: string; code: string };

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

export type Inspection = {
  id: string;
  mineId: string;
  inspectorId: string;
  type: InspectionType;
  status: InspectionStatus;
  scheduledDate: string;
  completedDate: string | null;
  summary: string | null;
  findings: Record<string, unknown> | null;
  riskScore: number | null;
  riskReasons: string[];
  createdAt: string;
  updatedAt: string;
};

// GET /api/inspections, GET /api/inspections/{id}, PATCH /api/inspections/{id}
// include `mine` and `inspector`. POST /api/inspections does NOT — it
// returns the bare `Inspection` above.
export type InspectionWithRelations = Inspection & {
  mine: MineRef;
  inspector: UserRef;
};

// ---------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------

export type Alert = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  mineId: string | null;
  inspectionId: string | null;
  violationId: string | null;
  reportId: string | null;
  triggerData: Record<string, unknown> | null;
  assignedToId: string | null;
  acknowledgedById: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

// GET /api/alerts, GET /api/alerts/{id}, PATCH /api/alerts/{id} include all
// of these. POST /api/alerts does NOT — it returns the bare `Alert` above.
export type AlertWithRelations = Alert & {
  mine: MineRef | null;
  inspection: { id: string; scheduledDate: string; status: InspectionStatus } | null;
  violation: { id: string; code: string; severity: ViolationSeverity } | null;
  report: { id: string; title: string; type: ReportType } | null;
  assignedTo: UserRef | null;
  acknowledgedBy: UserRef | null;
};

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type Report = {
  id: string;
  mineId: string;
  authorId: string;
  type: ReportType;
  status: ReportStatus;
  title: string;
  body: string;
  periodStart: string;
  periodEnd: string;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Every /api/reports route (list/get/create/update) includes these.
export type ReportWithRelations = Report & {
  mine: MineRef;
  author: UserRef;
};

// ---------------------------------------------------------------------------
// Violation
// ---------------------------------------------------------------------------

export type Violation = {
  id: string;
  mineId: string;
  inspectionId: string | null;
  issuedById: string;
  severity: ViolationSeverity;
  status: ViolationStatus;
  code: string;
  description: string;
  penaltyAmount: number;
  rectifiedAt: string | null;
  escalatedAt: string | null;
  escalationCount: number;
  createdAt: string;
  updatedAt: string;
};

// Every /api/violations route (list/get/create/update) includes these.
export type ViolationWithRelations = Violation & {
  mine: MineRef;
  inspection: { id: string; scheduledDate: string; status: InspectionStatus } | null;
  issuedBy: UserRef;
};

// ---------------------------------------------------------------------------
// Environmental reading
// ---------------------------------------------------------------------------

export type EnvironmentalReading = {
  id: string;
  mineId: string;
  parameter: string;
  value: number;
  unit: string;
  threshold: number | null;
  exceededAt: string | null;
  createdAt: string;
};

// Every /api/environmental-readings route (list/create) includes `mine`.
export type EnvironmentalReadingWithRelations = EnvironmentalReading & {
  mine: MineRef;
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditLog = {
  id: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  payload: Record<string, unknown> | null;
  resultHash: string | null;
  prevHash: string | null;
  createdAt: string;
};

// Every /api/audit-logs route (list/get) includes `actor`.
export type AuditLogWithRelations = AuditLog & {
  actor: UserRefWithRole | null;
};

export type ChainReport = {
  totalRows: number;
  broken: number;
  firstBrokenAt: number | null;
  firstBrokenId: string | null;
};

// ---------------------------------------------------------------------------
// AI risk
// ---------------------------------------------------------------------------

export type AiRiskResponse = {
  inspectionId: string;
  score: number;
  reasons: string[];
  alertId: string | null;
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DashboardSummary = {
  mines: { total: number; active: number };
  inspections: { total: number; overdue: number; completed: number };
  alerts: { total: number; open: number; critical: number };
  violations: { total: number; open: number; critical: number };
  reports: { total: number; submitted: number; approved: number };
};

// ---------------------------------------------------------------------------
// Workflow (cron-secret protected, not JWT)
// ---------------------------------------------------------------------------

export type WorkflowTriggerType =
  | 'INSPECTION_OVERDUE'
  | 'REPEATED_VIOLATIONS'
  | 'HIGH_AI_RISK'
  | 'MISSING_REPORT'
  | 'ENVIRONMENTAL_THRESHOLD';

export type WorkflowRunResult = {
  triggered: { type: WorkflowTriggerType; count: number; alertIds: string[] }[];
  createdAt: string;
};
