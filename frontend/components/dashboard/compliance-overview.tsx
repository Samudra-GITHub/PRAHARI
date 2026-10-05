// Breakdown of the real report/violation/mine counts from
// GET /api/dashboard/summary. There is no historical time-series endpoint
// anywhere in the backend, so this deliberately shows a point-in-time
// breakdown rather than a fabricated "trend" — a trend line would need
// data the API doesn't provide.

import type { LucideIcon } from 'lucide-react';
import { FileText, FileCheck2, ShieldAlert, Mountain, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatBar } from '@/components/ui/stat-bar';
import { ArcGauge } from './metric-visuals';
import { cn } from '@/lib/utils';
import type { DashboardSummary } from '@/types/models';

type Tone = 'primary' | 'gold' | 'warning' | 'danger' | 'success';

const TONE_ICON: Record<Tone, string> = {
  primary: 'bg-primary/15 text-primary-soft ring-primary/25',
  gold: 'bg-gold/15 text-gold ring-gold/25',
  success: 'bg-success/15 text-success ring-success/25',
  warning: 'bg-warning/12 text-warning ring-warning/25',
  danger: 'bg-danger/12 text-danger ring-danger/25',
};

function Row({
  icon: Icon,
  label,
  value,
  max,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  max: number;
  tone: Tone;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-body flex min-w-0 items-center gap-2.5 text-foreground">
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset', TONE_ICON[tone])}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="truncate">{label}</span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span className="tabular text-sm font-medium text-foreground">
            {value}
            <span className="text-muted-foreground"> / {max}</span>
          </span>
          <span className="tabular text-caption w-9 text-right text-muted-foreground">{pct}%</span>
        </span>
      </div>
      <StatBar value={value} max={max} tone={tone} />
    </div>
  );
}

export function ComplianceOverview({ summary }: { summary: DashboardSummary }) {
  const { mines, reports, violations } = summary;
  const approvalRate = reports.total > 0 ? (reports.approved / reports.total) * 100 : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary-soft" aria-hidden />
          Compliance Health
        </CardTitle>
        <CardDescription>Report approval rate, active mines, and outstanding violations</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-6">
        {/* Aircraft-instrument arc — the headline number for this panel. */}
        <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-raised/40 py-4">
          <ArcGauge percent={approvalRate} colorVar="var(--success)" size={128} strokeWidth={10} />
          <span className="tabular -mt-1 text-2xl font-semibold text-foreground">{approvalRate.toFixed(0)}%</span>
          <span className="text-caption text-muted-foreground">Reports approved</span>
        </div>

        <div className="flex flex-col gap-5">
          <Row icon={Mountain} label="Active mines" value={mines.active} max={mines.total} tone="primary" />
          <Row icon={FileCheck2} label="Reports approved" value={reports.approved} max={reports.total} tone="success" />
          <Row
            icon={FileText}
            label="Reports awaiting approval"
            value={reports.submitted}
            max={reports.total}
            tone="gold"
          />
          <Row
            icon={ShieldAlert}
            label="Open violations"
            value={violations.open}
            max={violations.total}
            tone={violations.critical > 0 ? 'danger' : 'warning'}
          />
        </div>

        {violations.critical > 0 && (
          <p className="text-caption flex items-center gap-2 rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-danger">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {violations.critical} critical-severity violation{violations.critical === 1 ? '' : 's'} outstanding.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
