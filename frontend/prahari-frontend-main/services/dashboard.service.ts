// backend/src/app/api/dashboard/summary/** — role-scoped KPI summary.
// All roles; MINE_OFFICIAL sees only their mine's numbers.

import { api } from '@/lib/api';
import type { DashboardSummary } from '@/types/models';

export function getDashboardSummary(): Promise<DashboardSummary> {
  return api.get<DashboardSummary>('/api/dashboard/summary');
}
