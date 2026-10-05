'use client';

// The PRAHARI Command Center — the authenticated home route. Composes
// dashboard-specific components (components/dashboard/*) around the shared
// DashboardDataProvider context, which wraps useDashboardData() — the only
// place this page's data comes from: GET /api/dashboard/summary,
// /api/mines, /api/inspections, /api/alerts — all via the existing service
// layer, no raw fetches here.

import { useAuth } from '@/components/auth/auth-provider';
import { useDashboardDataContext } from '@/components/dashboard/dashboard-data-context';
import { CommandHero } from '@/components/dashboard/command-hero';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { CoalfieldMap } from '@/components/dashboard/coalfield-map';
import { RiskDistribution } from '@/components/dashboard/risk-distribution';
import { ComplianceOverview } from '@/components/dashboard/compliance-overview';
import { AiInsights } from '@/components/dashboard/ai-insights';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { QuickActions } from '@/components/dashboard/quick-actions';

export default function HomePage() {
  const { user } = useAuth();
  const dashboard = useDashboardDataContext();

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <CommandHero user={user} dashboard={dashboard} onRefresh={dashboard.refetch} />

      {dashboard.status === 'loading' && <DashboardSkeleton />}

      {dashboard.status === 'error' && <DashboardError message={dashboard.message} onRetry={dashboard.refetch} />}

      {dashboard.status === 'ready' && (
        <div className="animate-enter flex flex-col gap-6">
          <KpiGrid data={dashboard.data} history={dashboard.history} />

          <CoalfieldMap mines={dashboard.data.mines} alerts={dashboard.data.recentAlerts} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RiskDistribution mines={dashboard.data.mines} />
            <ComplianceOverview summary={dashboard.data.summary} />
          </div>

          <AiInsights data={dashboard.data} history={dashboard.history} />

          <RecentActivity inspections={dashboard.data.recentInspections} alerts={dashboard.data.recentAlerts} />

          <QuickActions role={user.role} />
        </div>
      )}
    </div>
  );
}
