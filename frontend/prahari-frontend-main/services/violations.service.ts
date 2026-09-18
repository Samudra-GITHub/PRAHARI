// backend/src/app/api/violations/** — role-scoped violation CRUD.
// Read: all roles. Create/update: FIELD_INSPECTOR/MINE_OFFICIAL/CORPORATE_ADMIN.
// Delete: CORPORATE_ADMIN only.
//
// Setting status to ESCALATED increments escalationCount and stamps
// escalatedAt server-side; RECTIFIED stamps rectifiedAt
// (backend/src/app/api/violations/[id]/route.ts).

import { api } from '@/lib/api';
import type { Paginated, ListViolationsParams, CreateViolationBody, UpdateViolationBody } from '@/types/api';
import type { ViolationWithRelations } from '@/types/models';

export function listViolations(params?: ListViolationsParams): Promise<Paginated<ViolationWithRelations>> {
  return api.get<Paginated<ViolationWithRelations>>('/api/violations', { query: params });
}

export function getViolation(id: string): Promise<ViolationWithRelations> {
  return api.get<ViolationWithRelations>(`/api/violations/${id}`);
}

export function createViolation(body: CreateViolationBody): Promise<ViolationWithRelations> {
  return api.post<ViolationWithRelations>('/api/violations', body);
}

export function updateViolation(id: string, body: UpdateViolationBody): Promise<ViolationWithRelations> {
  return api.patch<ViolationWithRelations>(`/api/violations/${id}`, body);
}

// Backend returns { id } (not 204) on delete.
export function deleteViolation(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/api/violations/${id}`);
}
