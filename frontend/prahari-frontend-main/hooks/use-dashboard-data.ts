'use client';

// Loads everything the Command Center renders, from the real backend only:
//   - GET /api/dashboard/summary (role-scoped KPI counts)
//   - GET /api/mines             (real per-mine complianceScore, for the
//                                  risk-distribution section — the dashboard
//                                  summary endpoint has no risk/compliance
//                                  breakdown of its own)
//   - GET /api/inspections       (latest 5, for Recent Activity)
//   - GET /api/alerts            (latest 5, for Recent Activity)
//
// All four are role-scoped server-side already (see each service's own
// comments), so this hook doesn't need to know or care what role is
// signed in — it just renders whatever the backend is willing to return.
//
// Only the summary is essential. The other three feed individual sections,
// so each one fails on its own (null) instead of blanking the whole page —
// one broken endpoint shouldn't take the Command Center down for a role.

import { useCallback, useEffect, useState } from 'react';
import { getDashboardSummary } from '@/services/dashboard.service';
import { listMines } from '@/services/mines.service';
import { listInspections } from '@/services/inspections.service';
import { listAlerts } from '@/services/alerts.service';
import { ApiError } from '@/lib/api';
import type { DashboardSummary, Mine, InspectionWithRelations, AlertWithRelations } from '@/types/models';

export type DashboardData = {
  summary: DashboardSummary;
  // null = that request failed; the section renders its own error state.
  mines: Mine[] | null;
  recentInspections: InspectionWithRelations[] | null;
  recentAlerts: AlertWithRelations[] | null;
  // When this snapshot was actually retrieved — shown as the "as of" stamp so
  // the console never implies the numbers are more live than they are.
  fetchedAt: Date;
};

export type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DashboardData };

function valueOrNull<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

export function useDashboardData(): DashboardState & { refetch: () => void } {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const refetch = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState({ status: 'loading' });
      const [summary, mines, inspections, alerts] = await Promise.allSettled([
        getDashboardSummary(),
        // Aggregates over the first page of mines this role can see. Fine
        // for the current scale of demo/pilot data; a mine count beyond
        // pageSize would need real pagination in the risk section later.
        listMines({ pageSize: 100 }),
        listInspections({ pageSize: 5, sort: 'updatedAt:desc' }),
        listAlerts({ pageSize: 5, sort: 'createdAt:desc' }),
      ]);
      if (cancelled) return;

      if (summary.status === 'rejected') {
        setState({
          status: 'error',
          message: summary.reason instanceof ApiError ? summary.reason.message : 'Failed to load dashboard data.',
        });
        return;
      }

      setState({
        status: 'ready',
        data: {
          summary: summary.value,
          mines: valueOrNull(mines)?.items ?? null,
          recentInspections: valueOrNull(inspections)?.items ?? null,
          recentAlerts: valueOrNull(alerts)?.items ?? null,
          fetchedAt: new Date(),
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...state, refetch };
}
