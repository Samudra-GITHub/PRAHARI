// Types for the backend's response envelope and request bodies.
// Mirrors backend/src/lib/http.ts (envelope) and backend/src/lib/validators.ts
// (request body shapes / constraints) exactly.

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
// Response envelope — backend/src/lib/http.ts
// ---------------------------------------------------------------------------

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResult<T> = ApiOk<T> | ApiErr;

// Shape returned by every paginated GET endpoint (mines, inspections,
// alerts, reports, violations, audit-logs, environmental-readings).
export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

// Common query params accepted by every paginated list endpoint
// (backend/src/lib/validators.ts `ListQuery`).
export type ListQueryParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string; // e.g. "createdAt:desc"
};

// ---------------------------------------------------------------------------
// Auth request bodies
// ---------------------------------------------------------------------------

export type LoginBody = {
  email: string;
  password: string; // 8-128 chars
};

export type RegisterBody = {
  email: string;
  password: string; // 8-128 chars
  name: string;
  role?: Role;
  mineId?: string;
};

export type AuthResponse = {
  accessToken: string;
  user: import('./models').User;
};

// ---------------------------------------------------------------------------
// Mines
// ---------------------------------------------------------------------------

export type CreateMineBody = {
  name: string;
  code: string;
  location: string;
  region?: string;
  status?: MineStatus;
  complianceScore?: number; // 0-100
};

export type UpdateMineBody = Partial<CreateMineBody>;

export type ListMinesParams = ListQueryParams;

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

export type CreateInspectionBody = {
  mineId: string;
  inspectorId?: string; // defaults to the authenticated user
  type?: InspectionType;
  status?: InspectionStatus;
  scheduledDate: string; // ISO datetime
  completedDate?: string | null; // ISO datetime
  summary?: string;
  findings?: Record<string, unknown>;
  riskScore?: number; // 0-1
  riskReasons?: string[];
};

export type UpdateInspectionBody = Partial<CreateInspectionBody>;

export type ListInspectionsParams = ListQueryParams & {
  mineId?: string;
  status?: InspectionStatus;
};

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type CreateAlertBody = {
  type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
  title: string;
  message: string;
  mineId?: string | null;
  inspectionId?: string | null;
  violationId?: string | null;
  reportId?: string | null;
  triggerData?: Record<string, unknown> | null;
  assignedToId?: string | null;
  dueDate?: string | null; // ISO datetime
};

export type UpdateAlertBody = Partial<CreateAlertBody>;

export type ListAlertsParams = ListQueryParams & {
  mineId?: string;
  status?: AlertStatus;
  severity?: AlertSeverity;
  type?: AlertType;
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type CreateReportBody = {
  mineId: string;
  type: ReportType;
  title: string;
  body: string;
  periodStart: string; // ISO datetime
  periodEnd: string; // ISO datetime
};

export type UpdateReportBody = {
  type?: ReportType;
  status?: ReportStatus; // SUBMITTED (author) / APPROVED|REJECTED (CORPORATE_ADMIN only)
  title?: string;
  body?: string;
  periodStart?: string;
  periodEnd?: string;
};

export type ListReportsParams = ListQueryParams & {
  mineId?: string;
  status?: ReportStatus;
  type?: ReportType;
};

// ---------------------------------------------------------------------------
// Violations
// ---------------------------------------------------------------------------

export type CreateViolationBody = {
  mineId: string;
  inspectionId?: string | null;
  severity?: ViolationSeverity;
  status?: ViolationStatus;
  code: string;
  description: string;
  penaltyAmount?: number;
};

export type UpdateViolationBody = Partial<CreateViolationBody>;

export type ListViolationsParams = ListQueryParams & {
  mineId?: string;
  status?: ViolationStatus;
  code?: string;
};

// ---------------------------------------------------------------------------
// Environmental readings
// ---------------------------------------------------------------------------

export type CreateEnvironmentalReadingBody = {
  mineId: string;
  parameter: string;
  value: number;
  unit: string;
  threshold?: number;
};

export type ListEnvironmentalReadingsParams = ListQueryParams & {
  mineId?: string;
  parameter?: string;
};

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export type ListAuditLogsParams = ListQueryParams & {
  action?: string;
  resource?: string;
  actorId?: string;
  resourceId?: string;
};

// ---------------------------------------------------------------------------
// AI risk
// ---------------------------------------------------------------------------

export type AiRiskBody = {
  inspectionId: string;
  summary?: string;
  findings?: Record<string, unknown>;
};
