// Shared types for the PRAHARI Copilot retrieval-augmented pipeline:
//   question -> detectIntent() -> retrieve() -> buildPrompt() -> Groq stream
//
// Every field on RetrievalResult is populated straight from Prisma queries
// in retrieval.ts — nothing here is ever filled in by the LLM. The LLM only
// ever sees a rendering of this object and is instructed to describe it,
// not to add facts beyond it.

import type {
  AlertSeverity,
  AlertStatus,
  InspectionStatus,
  ReportStatus,
  ViolationSeverity,
  ViolationStatus,
} from '@/generated/prisma/client';

export type CopilotIntent =
  | 'HIGH_RISK_MINES'
  | 'MINE_STATUS'
  | 'MINE_PROFILE'
  | 'EXPLAIN_RISK'
  | 'OVERDUE_INSPECTIONS'
  | 'INSPECTION_HISTORY'
  | 'VIOLATIONS_QUERY'
  | 'ALERTS_QUERY'
  | 'ENVIRONMENTAL_QUERY'
  | 'REPORTS_QUERY'
  | 'COMPLIANCE_SUMMARY'
  | 'SAFETY_TIMELINE'
  | 'GENERATE_REPORT'
  | 'GENERAL';

export type ConversationContext = {
  lastMineIds?: string[];
  focusedMineId?: string;
};

export type ResolvedEntities = {
  mineIds: string[];
  region?: string;
  timeRangeDays?: number;
  environmentalParameter?: string;
  violationStatus?: ViolationStatus;
  violationSeverity?: ViolationSeverity;
  alertStatus?: AlertStatus;
  alertSeverity?: AlertSeverity;
  reportStatus?: ReportStatus;
  inspectionStatus?: InspectionStatus;
  repeated?: boolean;
  critical?: boolean;
  // A numeric score mentioned in the question (e.g. "risk score 82"),
  // normalised to the stored 0..1 scale. Only used by EXPLAIN_RISK.
  mentionedScore?: number;
};

export type NluResult = {
  intent: CopilotIntent;
  entities: ResolvedEntities;
};

export type EvidenceRef = {
  label: string;
  type: 'inspection' | 'alert' | 'violation' | 'reading' | 'report' | 'mine';
  id: string;
};

export type MineLite = { id: string; name: string; code: string; region: string | null; complianceScore: number; status: string };

// The structured, always-real payload the frontend renders as cards/tables
// without waiting on (or trusting) the LLM's prose for any number.
export type RetrievalResult = {
  intent: CopilotIntent;
  entities: ResolvedEntities;
  mines: MineLite[];
  mineDetail: Record<string, unknown> | null;
  inspections: Record<string, unknown>[];
  violations: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  readings: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  summary: Record<string, number> | null;
  timeline: { label: string; value: number }[] | null;
  evidence: EvidenceRef[];
  // Honesty notes surfaced verbatim in the UI — e.g. "no historical
  // compliance-score series exists" — instead of letting the model guess.
  notes: string[];
  // Present only for GENERATE_REPORT — the frontend renders a "Download
  // PDF" action that calls the existing, unmodified
  // GET /api/mines/{id}/compliance-report route. No PDF logic is duplicated.
  reportAction: { mineId: string; mineName: string } | null;
  // Conversational memory to hand back to the client for the next turn.
  nextContext: ConversationContext;
  deniedReason: string | null;
};
