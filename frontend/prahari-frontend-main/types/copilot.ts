// Types mirroring backend/src/lib/copilot/types.ts and the NDJSON stream
// shape emitted by POST /api/copilot/chat (backend/src/app/api/copilot/chat/route.ts).
// Nested record shapes (inspections, alerts, etc.) are typed loosely as
// Record<string, unknown> here too, matching the backend — the concrete
// fields rendered are read defensively in the UI components rather than
// assumed, since the backend intentionally returns whatever a given intent
// actually populated.

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

export type EvidenceRef = {
  label: string;
  type: 'inspection' | 'alert' | 'violation' | 'reading' | 'report' | 'mine';
  id: string;
};

export type MineLite = {
  id: string;
  name: string;
  code: string;
  region: string | null;
  complianceScore: number;
  status: string;
};

export type RetrievalResult = {
  intent: CopilotIntent;
  entities: Record<string, unknown>;
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
  notes: string[];
  reportAction: { mineId: string; mineName: string } | null;
  nextContext: ConversationContext;
  deniedReason: string | null;
};

export type CopilotStreamEvent =
  | { type: 'context'; data: RetrievalResult }
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  retrieval?: RetrievalResult;
  streaming?: boolean;
  errorMessage?: string;
};

export type CopilotSession = {
  id: string;
  title: string;
  messages: CopilotMessage[];
  context: ConversationContext;
  createdAt: string;
  updatedAt: string;
};
