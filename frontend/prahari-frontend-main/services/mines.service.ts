// backend/src/app/api/mines/** — role-scoped mine CRUD.
// Read: all roles. Write (create/update/delete): CORPORATE_ADMIN only.

import { api } from '@/lib/api';
import type { Paginated, ListMinesParams, CreateMineBody, UpdateMineBody } from '@/types/api';
import type { Mine } from '@/types/models';

export function listMines(params?: ListMinesParams): Promise<Paginated<Mine>> {
  return api.get<Paginated<Mine>>('/api/mines', { query: params });
}

export function getMine(id: string): Promise<Mine> {
  return api.get<Mine>(`/api/mines/${id}`);
}

export function createMine(body: CreateMineBody): Promise<Mine> {
  return api.post<Mine>('/api/mines', body);
}

export function updateMine(id: string, body: UpdateMineBody): Promise<Mine> {
  return api.patch<Mine>(`/api/mines/${id}`, body);
}

// Backend returns { id } (not 204) on delete — see mines/[id]/route.ts.
export function deleteMine(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/api/mines/${id}`);
}
