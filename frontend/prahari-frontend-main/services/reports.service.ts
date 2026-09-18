// backend/src/app/api/reports/** — role-scoped report CRUD + workflow.
// Read: MINE_OFFICIAL/CORPORATE_ADMIN/REGULATOR (not FIELD_INSPECTOR).
// Create/update: MINE_OFFICIAL/CORPORATE_ADMIN. Delete: CORPORATE_ADMIN only.
//
// Status transitions enforced server-side (backend/src/app/api/reports/[id]/route.ts):
//   DRAFT -> SUBMITTED (author)
//   SUBMITTED -> APPROVED | REJECTED (CORPORATE_ADMIN only)
//   REJECTED -> SUBMITTED (resubmit) is allowed; other transitions 409.

import { api, ApiError, API_BASE_URL } from '@/lib/api';
import { getAccessToken, refreshAccessToken } from '@/lib/auth';
import type { Paginated, ListReportsParams, CreateReportBody, UpdateReportBody } from '@/types/api';
import type { ReportWithRelations } from '@/types/models';

export function listReports(params?: ListReportsParams): Promise<Paginated<ReportWithRelations>> {
  return api.get<Paginated<ReportWithRelations>>('/api/reports', { query: params });
}

export function getReport(id: string): Promise<ReportWithRelations> {
  return api.get<ReportWithRelations>(`/api/reports/${id}`);
}

export function createReport(body: CreateReportBody): Promise<ReportWithRelations> {
  return api.post<ReportWithRelations>('/api/reports', body);
}

export function updateReport(id: string, body: UpdateReportBody): Promise<ReportWithRelations> {
  return api.patch<ReportWithRelations>(`/api/reports/${id}`, body);
}

// Backend returns { id } (not 204) on delete.
export function deleteReport(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/api/reports/${id}`);
}

// GET /api/mines/{id}/compliance-report — returns a raw application/pdf body,
// not the {ok,data} JSON envelope, so this bypasses lib/api.ts's apiFetch
// (which always parses JSON) the same way lib/api.ts itself does its own raw
// fetch. Still reuses the same token/refresh handling.
export async function getComplianceReportPdf(mineId: string): Promise<Blob> {
  const fetchOnce = () =>
    fetch(`${API_BASE_URL}/api/mines/${mineId}/compliance-report`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      credentials: 'include',
    });

  let res = await fetchOnce();
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await fetchOnce();
  }
  if (!res.ok) {
    let message = 'Failed to generate report';
    let code = 'UNKNOWN_ERROR';
    try {
      const json = await res.json();
      message = json?.error?.message ?? message;
      code = json?.error?.code ?? code;
    } catch {
      // Non-JSON error body — fall back to the generic message above.
    }
    throw new ApiError(message, code, res.status);
  }
  return res.blob();
}
