// backend/src/app/api/environmental-readings/** — record/list readings.
// Read: all roles. Create: FIELD_INSPECTOR/MINE_OFFICIAL/CORPORATE_ADMIN.
// No single-resource GET/PATCH/DELETE route exists for this resource — only
// list + create.

import { api } from '@/lib/api';
import type { Paginated, ListEnvironmentalReadingsParams, CreateEnvironmentalReadingBody } from '@/types/api';
import type { EnvironmentalReadingWithRelations } from '@/types/models';

export function listEnvironmentalReadings(
  params?: ListEnvironmentalReadingsParams,
): Promise<Paginated<EnvironmentalReadingWithRelations>> {
  return api.get<Paginated<EnvironmentalReadingWithRelations>>('/api/environmental-readings', { query: params });
}

export function createEnvironmentalReading(
  body: CreateEnvironmentalReadingBody,
): Promise<EnvironmentalReadingWithRelations> {
  return api.post<EnvironmentalReadingWithRelations>('/api/environmental-readings', body);
}
