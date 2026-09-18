// Rule-based "AI Safety Insights" — every card here is derived purely from
// fields the backend already returns (DashboardData, itself built only from
// GET /api/dashboard/summary, /api/mines, /api/inspections, /api/alerts).
// Nothing here calls a model or invents a statistic: it's the same kind of
// presentation-only derivation as lib/risk.ts's compliance banding, just
// composed into short, readable findings. Where the backend genuinely has no
// signal (e.g. no historical time series to judge a trend from), the card
// says so instead of guessing.

import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Mountain, ClipboardX, Leaf, Sparkles, Minus } from 'lucide-react';
import { classifyMineRisk, RISK_LABELS } from './risk';
import type { DashboardData } from '@/hooks/use-dashboard-data';

export type InsightTone = 'critical' | 'warning' | 'success' | 'neutral';

export type Insight = {
  id: string;
  icon: LucideIcon;
  tone: InsightTone;
  title: string;
  detail: string;
};

// One point in the session's own rolling history of a fetch — real snapshots
// taken each time the Command Center loads or is refreshed, not a fabricated
// backend time series. See DashboardDataProvider.
export type DashboardSnapshot = {
  at: number;
  avgCompliance: number | null;
  alertsOpen: number;
  highRiskMines: number | null;
  overdueInspections: number;
};

export function deriveInsights(data: DashboardData, history: DashboardSnapshot[]): Insight[] {
  const insights: Insight[] = [];
  const { summary, mines, recentInspections, recentAlerts } = data;

  // 1. Highest-risk mine — the real lowest complianceScore in the portfolio.
  if (mines && mines.length > 0) {
    const worst = mines.slice().sort((a, b) => a.complianceScore - b.complianceScore)[0];
    const level = classifyMineRisk(worst.complianceScore);
    insights.push({
      id: 'highest-risk-mine',
      icon: Mountain,
      tone: level === 'high' ? 'critical' : level === 'medium' ? 'warning' : 'success',
      title: level === 'low' ? 'No mine in high risk' : `${worst.name} needs attention`,
      detail:
        level === 'low'
          ? `Lowest score in the portfolio is still ${RISK_LABELS.low.toLowerCase()} at ${worst.complianceScore.toFixed(1)}%.`
          : `Compliance score ${worst.complianceScore.toFixed(1)}% — ${RISK_LABELS[level].toLowerCase()}, the lowest of ${mines.length} monitored mines.`,
    });
  }

  // 2. Compliance trend — only claimed once this session has actually
  // observed two snapshots; otherwise say so rather than guess.
  const withScore = history.filter((h) => h.avgCompliance !== null) as { avgCompliance: number; at: number }[];
  if (withScore.length >= 2) {
    const first = withScore[0].avgCompliance;
    const last = withScore[withScore.length - 1].avgCompliance;
    const delta = last - first;
    insights.push({
      id: 'compliance-trend',
      icon: delta > 0.05 ? TrendingUp : delta < -0.05 ? TrendingDown : Minus,
      tone: delta > 0.05 ? 'success' : delta < -0.05 ? 'warning' : 'neutral',
      title: delta > 0.05 ? 'Compliance improving this session' : delta < -0.05 ? 'Compliance slipping this session' : 'Compliance holding steady',
      detail: `Average score moved ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts since this console was opened.`,
    });
  } else {
    insights.push({
      id: 'compliance-trend',
      icon: Minus,
      tone: 'neutral',
      title: 'Trend building',
      detail: 'Refresh the console again to start tracking compliance movement this session.',
    });
  }

  // 3. Overdue inspections — real aggregate, named example when one is in
  // the latest-5 feed.
  if (summary.inspections.overdue > 0) {
    const example = recentInspections?.find((i) => i.status === 'OVERDUE');
    insights.push({
      id: 'inspections-overdue',
      icon: ClipboardX,
      tone: summary.inspections.overdue >= 3 ? 'critical' : 'warning',
      title: `${summary.inspections.overdue} inspection${summary.inspections.overdue === 1 ? '' : 's'} overdue`,
      detail: example
        ? `${example.mine.name} is past its scheduled ${example.type.toLowerCase()} inspection.`
        : 'Scheduled inspections have slipped past their due date across the portfolio.',
    });
  } else {
    insights.push({
      id: 'inspections-overdue',
      icon: ClipboardX,
      tone: 'success',
      title: 'Inspections on schedule',
      detail: `All ${summary.inspections.total} tracked inspections are within schedule.`,
    });
  }

  // 4. Environmental anomaly — only from alerts actually flagged
  // ENVIRONMENTAL_THRESHOLD in the real recent-alerts feed. Absence of one in
  // the latest 5 is reported as "none recent", never as "clear" (the feed is
  // capped at 5, so an older anomaly could exist outside this window).
  const envAlert = recentAlerts?.find((a) => a.type === 'ENVIRONMENTAL_THRESHOLD');
  insights.push({
    id: 'environmental',
    icon: Leaf,
    tone: envAlert ? (envAlert.severity === 'CRITICAL' || envAlert.severity === 'HIGH' ? 'critical' : 'warning') : 'success',
    title: envAlert ? 'Environmental threshold breached' : 'No recent environmental anomalies',
    detail: envAlert
      ? `${envAlert.title} at ${envAlert.mine?.name ?? 'a monitored site'}.`
      : 'None of the latest 5 alerts flag an environmental threshold breach.',
  });

  // 5. Rule-based recommendation — a plain composition of the real counts
  // above, not a model call. Picks the single highest-priority signal.
  const highRisk = mines?.filter((m) => classifyMineRisk(m.complianceScore) === 'high').length ?? 0;
  let recTitle: string;
  let recDetail: string;
  let recTone: InsightTone;
  if (summary.alerts.critical > 0) {
    recTone = 'critical';
    recTitle = 'Clear critical alerts first';
    recDetail = `${summary.alerts.critical} critical alert${summary.alerts.critical === 1 ? '' : 's'} outstanding — resolve before addressing lower-severity items.`;
  } else if (highRisk > 0) {
    recTone = 'warning';
    recTitle = 'Prioritise high-risk mines';
    recDetail = `${highRisk} mine${highRisk === 1 ? ' is' : 's are'} below the ${RISK_LABELS.high.toLowerCase()} threshold — schedule inspections there next.`;
  } else if (summary.inspections.overdue > 0) {
    recTone = 'warning';
    recTitle = 'Close out overdue inspections';
    recDetail = `${summary.inspections.overdue} inspection${summary.inspections.overdue === 1 ? '' : 's'} overdue portfolio-wide.`;
  } else {
    recTone = 'success';
    recTitle = 'Portfolio nominal';
    recDetail = 'No critical alerts, high-risk mines, or overdue inspections detected.';
  }
  insights.push({ id: 'recommendation', icon: Sparkles, tone: recTone, title: recTitle, detail: recDetail });

  return insights;
}
