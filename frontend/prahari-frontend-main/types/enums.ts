// Enum types mirroring backend/prisma/schema.prisma and
// backend/src/lib/openapi/spec.ts exactly. Keep these in sync with the
// backend if the schema changes — do not add values that don't exist there.

export type Role = 'FIELD_INSPECTOR' | 'MINE_OFFICIAL' | 'CORPORATE_ADMIN' | 'REGULATOR';

export type MineStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type InspectionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';

export type InspectionType = 'SAFETY' | 'ENVIRONMENTAL' | 'EQUIPMENT' | 'COMPLIANCE' | 'ROUTINE';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

export type AlertType =
  | 'INSPECTION_OVERDUE'
  | 'REPEATED_VIOLATIONS'
  | 'HIGH_AI_RISK'
  | 'MISSING_REPORT'
  | 'ENVIRONMENTAL_THRESHOLD'
  | 'MANUAL';

export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type ReportType = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'INCIDENT' | 'COMPLIANCE';

export type ViolationStatus = 'OPEN' | 'NOTIFIED' | 'RECTIFIED' | 'ESCALATED' | 'CLOSED';

export type ViolationSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';
