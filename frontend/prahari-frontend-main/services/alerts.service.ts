// backend/src/app/api/alerts/** — role-scoped alert CRUD.
// Read: all roles. Create/update: MINE_OFFICIAL/CORPORATE_ADMIN (update also
// allows FIELD_INSPECTOR). Delete: CORPORATE_ADMIN only.

import { api } from '@/lib/api';
import type { Paginated, ListAlertsParams, CreateAlertBody, UpdateAlertBody } from '@/types/api';
import type { Alert, AlertWithRelations } from '@/types/models';

export function listAlerts(params?: ListAlertsParams): Promise<Paginated<AlertWithRelations>> {
  return api.get<Paginated<AlertWithRelations>>('/api/alerts', { query: params });
}

export function getAlert(id: string): Promise<AlertWithRelations> {
  return api.get<AlertWithRelations>(`/api/alerts/${id}`);
}

// Note: unlike list/get/update, POST does not `include` relations — see
// backend/src/app/api/alerts/route.ts.
export function createAlert(body: CreateAlertBody): Promise<Alert> {
  return api.post<Alert>('/api/alerts', body);
}

// Setting status to ACKNOWLEDGED/RESOLVED also stamps acknowledgedAt/
// resolvedAt server-side (backend/src/app/api/alerts/[id]/route.ts).
export function updateAlert(id: string, body: UpdateAlertBody): Promise<AlertWithRelations> {
  return api.patch<AlertWithRelations>(`/api/alerts/${id}`, body);
}

// Backend returns { id } (not 204) on delete.
export function deleteAlert(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/api/alerts/${id}`);
}
