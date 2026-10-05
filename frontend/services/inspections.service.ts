// backend/src/app/api/inspections/** — role-scoped inspection CRUD.
// Read: all roles (FIELD_INSPECTOR sees only their own; MINE_OFFICIAL only
// their mine's). Write: FIELD_INSPECTOR/MINE_OFFICIAL/CORPORATE_ADMIN.
// Delete: CORPORATE_ADMIN only.

import { api } from '@/lib/api';
import type { Paginated, ListInspectionsParams, CreateInspectionBody, UpdateInspectionBody } from '@/types/api';
import type { Inspection, InspectionWithRelations } from '@/types/models';

export function listInspections(params?: ListInspectionsParams): Promise<Paginated<InspectionWithRelations>> {
  return api.get<Paginated<InspectionWithRelations>>('/api/inspections', { query: params });
}

export function getInspection(id: string): Promise<InspectionWithRelations> {
  return api.get<InspectionWithRelations>(`/api/inspections/${id}`);
}

// Note: unlike list/get/update, POST does not `include` the mine/inspector
// relations — see backend/src/app/api/inspections/route.ts.
export function createInspection(body: CreateInspectionBody): Promise<Inspection> {
  return api.post<Inspection>('/api/inspections', body);
}

export function updateInspection(id: string, body: UpdateInspectionBody): Promise<InspectionWithRelations> {
  return api.patch<InspectionWithRelations>(`/api/inspections/${id}`, body);
}

// Backend returns { id } (not 204) on delete.
export function deleteInspection(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/api/inspections/${id}`);
}
