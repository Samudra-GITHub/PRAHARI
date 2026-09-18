'use client';

// Wraps the existing, untouched useDashboardData() hook in a context so the
// same real fetch (GET /api/dashboard/summary, /api/mines, /api/inspections,
// /api/alerts) is shared by the Command Center page, the header's live
// status/notification chips, and the sidebar's nav badges — one request,
// several consumers, instead of each one re-fetching independently.
//
// Also keeps a small session-local history of the average compliance score
// across successful loads, purely so the UI can show a real "moved N pts
// since this console was opened" trend (lib/insights.ts) instead of
// fabricating one — the backend has no historical time-series endpoint.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDashboardData, type DashboardState } from '@/hooks/use-dashboard-data';
import { classifyMineRisk } from '@/lib/risk';
import type { DashboardSnapshot } from '@/lib/insights';

const MAX_HISTORY = 12;

type DashboardDataContextValue = DashboardState & {
  refetch: () => void;
  history: DashboardSnapshot[];
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const dashboard = useDashboardData();
  const [history, setHistory] = useState<DashboardSnapshot[]>([]);
  const lastRecordedAt = useRef<number | null>(null);

  useEffect(() => {
    if (dashboard.status !== 'ready') return;
    const at = dashboard.data.fetchedAt.getTime();
    if (lastRecordedAt.current === at) return;
    lastRecordedAt.current = at;

    const { mines, summary } = dashboard.data;
    const avgCompliance = mines && mines.length > 0 ? mines.reduce((s, m) => s + m.complianceScore, 0) / mines.length : null;
    const highRiskMines = mines ? mines.filter((m) => classifyMineRisk(m.complianceScore) === 'high').length : null;

    setHistory((prev) =>
      [
        ...prev,
        { at, avgCompliance, highRiskMines, alertsOpen: summary.alerts.open, overdueInspections: summary.inspections.overdue },
      ].slice(-MAX_HISTORY),
    );
  }, [dashboard]);

  return <DashboardDataContext.Provider value={{ ...dashboard, history }}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardDataContext(): DashboardDataContextValue {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error('useDashboardDataContext() must be used within <DashboardDataProvider>');
  return ctx;
}

// Shared read used by both the header bell and the sidebar nav badges: real
// open-alert / overdue-inspection / open-violation counts when the data has
// loaded, otherwise null (so callers can hide the badge instead of showing a
// stale or fabricated zero).
export function useLiveCounts(): { alerts: number; overdue: number; violations: number } | null {
  const dashboard = useDashboardDataContext();
  if (dashboard.status !== 'ready') return null;
  const { summary } = dashboard.data;
  return { alerts: summary.alerts.open, overdue: summary.inspections.overdue, violations: summary.violations.open };
}

export function useHighRiskMineCount(): number | null {
  const dashboard = useDashboardDataContext();
  if (dashboard.status !== 'ready' || dashboard.data.mines === null) return null;
  return dashboard.data.mines.filter((m) => classifyMineRisk(m.complianceScore) === 'high').length;
}
