import { Gauge, Bell, TriangleAlert, ClipboardX } from 'lucide-react';
import { MetricPanel, type KpiTone, type Trend } from './kpi-card';
import { RingGauge, HeatGrid, PulseStack, ArcGauge } from './metric-visuals';
import { classifyMineRisk, type RiskLevel } from '@/lib/risk';
import { formatCount } from '@/lib/format';
import type { DashboardData } from '@/hooks/use-dashboard-data';
import type { DashboardSnapshot } from '@/lib/insights';

const RISK_TONE: Record<RiskLevel, KpiTone> = {
  high: 'critical',
  medium: 'warning',
  low: 'good',
};

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`;

// A trend needs two real session snapshots to say anything honest. `lowerIsBetter`
// flips which direction counts as "good" (fewer alerts is good; higher compliance is good).
function trendFrom(
  history: DashboardSnapshot[],
  select: (h: DashboardSnapshot) => number | null,
  lowerIsBetter: boolean,
): Trend | undefined {
  const points = history.map(select).filter((v): v is number => v !== null);
  if (points.length < 2) return undefined;

  const delta = points[points.length - 1] - points[0];
  if (Math.abs(delta) < 0.05) return { direction: 'flat', label: 'Steady this session', good: true };

  const direction = delta > 0 ? 'up' : 'down';
  const good = lowerIsBetter ? delta < 0 : delta > 0;
  const magnitude = Number.isInteger(delta) ? Math.abs(delta).toString() : Math.abs(delta).toFixed(1);
  return { direction, good, label: `${delta > 0 ? '+' : '-'}${magnitude} this session` };
}

export function KpiGrid({ data, history }: { data: DashboardData; history: DashboardSnapshot[] }) {
  const { summary, mines } = data;

  const avgCompliance =
    mines && mines.length > 0 ? mines.reduce((sum, m) => sum + m.complianceScore, 0) / mines.length : null;
  const complianceTone: KpiTone = avgCompliance === null ? 'neutral' : RISK_TONE[classifyMineRisk(avgCompliance)];

  const highRiskCount = mines?.filter((m) => classifyMineRisk(m.complianceScore) === 'high').length ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricPanel
        label="Compliance Score"
        icon={Gauge}
        tone={complianceTone}
        numericValue={avgCompliance}
        formatValue={(n) => `${n.toFixed(1)}%`}
        subtext={mines === null ? 'mine data unavailable' : mines.length > 0 ? `across ${plural(mines.length, 'mine')}` : 'no mines yet'}
        trend={trendFrom(history, (h) => h.avgCompliance, false)}
        sparklineValues={history.map((h) => h.avgCompliance)}
        visualization={
          avgCompliance !== null && (
            <div className="flex items-center gap-3">
              <RingGauge percent={avgCompliance} colorVar="var(--primary-soft)" />
              <span className="text-caption text-muted-foreground">Portfolio average</span>
            </div>
          )
        }
      />

      <MetricPanel
        label="Active Alerts"
        icon={Bell}
        tone={summary.alerts.critical > 0 ? 'critical' : summary.alerts.open > 0 ? 'warning' : 'good'}
        numericValue={summary.alerts.open}
        formatValue={(n) => formatCount(Math.round(n))}
        subtext={summary.alerts.critical > 0 ? `${formatCount(summary.alerts.critical)} critical` : 'none critical'}
        trend={trendFrom(history, (h) => h.alertsOpen, true)}
        sparklineValues={history.map((h) => h.alertsOpen)}
        visualization={<PulseStack total={summary.alerts.open} critical={summary.alerts.critical} />}
      />

      <MetricPanel
        label="High-Risk Mines"
        icon={TriangleAlert}
        tone={highRiskCount === null ? 'neutral' : highRiskCount > 0 ? 'critical' : 'good'}
        numericValue={highRiskCount}
        formatValue={(n) => formatCount(Math.round(n))}
        subtext={highRiskCount === null ? 'mine data unavailable' : `of ${plural(summary.mines.total, 'mine')}`}
        trend={trendFrom(history, (h) => h.highRiskMines, true)}
        sparklineValues={history.map((h) => h.highRiskMines)}
        visualization={mines && mines.length > 0 && <HeatGrid mines={mines} />}
      />

      <MetricPanel
        label="Overdue Inspections"
        icon={ClipboardX}
        tone={summary.inspections.overdue > 0 ? 'warning' : 'good'}
        numericValue={summary.inspections.overdue}
        formatValue={(n) => formatCount(Math.round(n))}
        subtext={`${formatCount(summary.inspections.completed)} of ${formatCount(summary.inspections.total)} completed`}
        trend={trendFrom(history, (h) => h.overdueInspections, true)}
        sparklineValues={history.map((h) => h.overdueInspections)}
        visualization={
          <div className="flex items-center gap-3">
            <ArcGauge
              percent={summary.inspections.total > 0 ? (summary.inspections.completed / summary.inspections.total) * 100 : 0}
              colorVar="var(--gold)"
              size={72}
              strokeWidth={6}
            />
            <span className="text-caption text-muted-foreground">Completion rate</span>
          </div>
        }
      />
    </div>
  );
}
