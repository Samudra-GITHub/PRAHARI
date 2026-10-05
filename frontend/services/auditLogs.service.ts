// backend/src/app/api/audit-logs/** — REGULATOR + CORPORATE_ADMIN only.
// Tamper-evident hash-chained log; no create/update/delete from the client
// (rows are written internally by backend/src/lib/audit.ts).

import { api } from '@/lib/api';
import type { Paginated, ListAuditLogsParams } from '@/types/api';
import type { AuditLogWithRelations, ChainReport } from '@/types/models';

export function listAuditLogs(params?: ListAuditLogsParams): Promise<Paginated<AuditLogWithRelations>> {
  return api.get<Paginated<AuditLogWithRelations>>('/api/audit-logs', { query: params });
}

export function getAuditLog(id: string): Promise<AuditLogWithRelations> {
  return api.get<AuditLogWithRelations>(`/api/audit-logs/${id}`);
}

// Re-walks the hash chain server-side and reports the first broken link, if any.
export function verifyAuditChain(): Promise<ChainReport> {
  return api.post<ChainReport>('/api/audit-logs/verify');
}
