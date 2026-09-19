// Zod validation helpers. Every endpoint that accepts a body uses one of
// these schemas so the OpenAPI spec can describe the exact request shape.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  role: z.enum(['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']).optional(),
  mineId: z.string().cuid().optional(),
});

export const RefreshBody = z.object({
  // Body refresh is optional — we also accept the refresh token from the
  // httpOnly cookie. If both are present, the cookie wins.
  refreshToken: z.string().optional(),
}).optional();

// ---------------------------------------------------------------------------
// Mines
// ---------------------------------------------------------------------------

export const CreateMineBody = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(40),
  location: z.string().min(1).max(240),
  region: z.string().max(80).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  complianceScore: z.number().min(0).max(100).optional(),
});

export const UpdateMineBody = CreateMineBody.partial();

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

export const CreateInspectionBody = z.object({
  mineId: z.string().cuid(),
  inspectorId: z.string().cuid().optional(), // defaults to authenticated user
  type: z.enum(['SAFETY', 'ENVIRONMENTAL', 'EQUIPMENT', 'COMPLIANCE', 'ROUTINE']).optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE']).optional(),
  scheduledDate: z.string().datetime(),
  completedDate: z.string().datetime().nullable().optional(),
  summary: z.string().max(1000).optional(),
  findings: z.record(z.string(), z.unknown()).optional(),
  riskScore: z.number().min(0).max(1).optional(),
  riskReasons: z.array(z.string()).optional(),
});

export const UpdateInspectionBody = CreateInspectionBody.partial();

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const CreateAlertBody = z.object({
  type: z.enum(['INSPECTION_OVERDUE', 'REPEATED_VIOLATIONS', 'HIGH_AI_RISK', 'MISSING_REPORT', 'ENVIRONMENTAL_THRESHOLD', 'MANUAL']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED']).optional(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  mineId: z.string().cuid().nullable().optional(),
  inspectionId: z.string().cuid().nullable().optional(),
  violationId: z.string().cuid().nullable().optional(),
  reportId: z.string().cuid().nullable().optional(),
  triggerData: z.record(z.string(), z.unknown()).nullable().optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const UpdateAlertBody = CreateAlertBody.partial();

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const CreateReportBody = z.object({
  mineId: z.string().cuid(),
  type: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'INCIDENT', 'COMPLIANCE']),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

export const UpdateReportBody = z.object({
  type: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'INCIDENT', 'COMPLIANCE']).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(20000).optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// Violations
// ---------------------------------------------------------------------------

export const CreateViolationBody = z.object({
  mineId: z.string().cuid(),
  inspectionId: z.string().cuid().nullable().optional(),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).optional(),
  status: z.enum(['OPEN', 'NOTIFIED', 'RECTIFIED', 'ESCALATED', 'CLOSED']).optional(),
  code: z.string().min(1).max(40),
  description: z.string().min(1).max(2000),
  penaltyAmount: z.number().min(0).optional(),
});

export const UpdateViolationBody = CreateViolationBody.partial();

// ---------------------------------------------------------------------------
// AI Risk
// ---------------------------------------------------------------------------

export const AiRiskBody = z.object({
  // Accept any non-empty string ID (Prisma's `cuid()` is the default but
  // callers may have seeded IDs like `demo-insp-1`).
  inspectionId: z.string().min(1).max(64),
  // Optional summary of findings to score; if omitted the API loads the
  // inspection's `summary` + `findings` from the DB.
  summary: z.string().max(2000).optional(),
  findings: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Environmental readings
// ---------------------------------------------------------------------------

export const CreateEnvironmentalReadingBody = z.object({
  mineId: z.string().cuid(),
  parameter: z.string().min(1).max(40),
  value: z.number(),
  unit: z.string().min(1).max(20),
  threshold: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Generic list-query params (used for paginated GET endpoints)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Copilot
// ---------------------------------------------------------------------------

export const CopilotChatBody = z.object({
  message: z.string().min(1).max(2000),
  // Prior turns of this conversation, oldest first — used so the model can
  // read back a couple of turns of context. Capped well below the model's
  // context window.
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }))
    .max(20)
    .optional(),
  // Lightweight conversational memory the client plays back on each turn
  // (no server-side chat storage exists) so references like "the second
  // one" or "it" can be resolved against what was just shown.
  context: z
    .object({
      lastMineIds: z.array(z.string()).max(20).optional(),
      focusedMineId: z.string().optional(),
    })
    .optional(),
});

export const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  sort: z.string().optional(),          // e.g. "createdAt:desc"
});

export type ListQueryT = z.infer<typeof ListQuery>;
