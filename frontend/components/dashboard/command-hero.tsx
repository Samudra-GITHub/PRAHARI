'use client';

// The Command Center masthead. Every figure here is real: mines-monitored
// comes straight from DashboardSummary, the AI Engine indicator reflects
// whether any of the latest 5 inspections actually carry a riskScore (the
// backend's real AI risk-scoring field), and the clock is the current time —
// nothing here is a placeholder statistic.

import { RefreshCw, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/shell/brand-mark';
import { useLiveClock } from '@/hooks/use-live-clock';
import { formatRole, formatClockTime, formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardState } from '@/hooks/use-dashboard-data';
import type { User } from '@/types/models';

const ROLE_SUBTITLES: Record<User['role'], string> = {
  FIELD_INSPECTOR: 'Your inspections, violations, and assigned mines at a glance.',
  MINE_OFFICIAL: "Your mine's compliance posture, alerts, and reporting status.",
  CORPORATE_ADMIN: 'Cross-mine compliance overview across the full portfolio.',
  REGULATOR: 'Read-only oversight across all mines and audit activity.',
};

export function CommandHero({
  user,
  dashboard,
  onRefresh,
}: {
  user: User;
  dashboard: DashboardState;
  onRefresh: () => void;
}) {
  const now = useLiveClock();

  const ready = dashboard.status === 'ready';
  const fetchedAt = ready ? dashboard.data.fetchedAt : undefined;
  const activeMines = ready ? dashboard.data.summary.mines.active : null;
  const totalMines = ready ? dashboard.data.summary.mines.total : null;
  const aiActive = ready ? (dashboard.data.recentInspections?.some((i) => i.riskScore !== null) ?? false) : false;

  const statusLabel = dashboard.status === 'loading' ? 'Syncing' : dashboard.status === 'error' ? 'Offline' : 'Live';
  const statusDot = dashboard.status === 'loading' ? 'bg-gold' : dashboard.status === 'error' ? 'bg-danger' : 'bg-success';
  const statusPulseColor =
    dashboard.status === 'error' ? 'oklch(0.655 0.185 25 / 45%)' : 'oklch(0.72 0.12 152 / 45%)';

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="bg-tactical-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(48rem 20rem at 15% 0%, oklch(0.46 0.088 155 / 0.16), transparent 65%)',
        }}
      />

      <div className="relative flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:gap-4">
            <BrandMark size="md" className="shrink-0" />
            <div className="flex flex-col gap-1.5 sm:pt-0.5">
              <h1 className="text-hero text-foreground">AI Compliance Command Center</h1>
              <p className="text-body max-w-xl text-muted-foreground">{ROLE_SUBTITLES[user.role]}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 self-start">
            <div className="flex flex-col items-end gap-1">
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-foreground/80 ring-1 ring-inset ring-border-strong"
              >
                <span
                  className={cn('h-1.5 w-1.5 rounded-full animate-pulse-ring', statusDot)}
                  style={{ '--pulse-color': statusPulseColor } as React.CSSProperties}
                  aria-hidden
                />
                {statusLabel}
              </span>
              <span className="text-readout text-caption text-muted-foreground">{formatClockTime(now)} IST</span>
            </div>
            <Button variant="outline" size="icon-sm" onClick={onRefresh} aria-label="Refresh data" title="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border pt-4">
          <HeroStat
            label="Role"
            value={formatRole(user.role)}
          />
          <HeroStat
            label="Mines monitored"
            value={activeMines === null || totalMines === null ? '—' : `${formatCount(activeMines)} / ${formatCount(totalMines)}`}
          />
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md ring-1 ring-inset',
                aiActive ? 'bg-primary/15 text-primary-soft ring-primary/25' : 'bg-muted text-muted-foreground ring-border-strong',
              )}
            >
              <Radio className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[0.625rem] uppercase tracking-[0.08em] text-muted-foreground/70">AI Engine</span>
              <span className="text-caption font-medium text-foreground">{aiActive ? 'Active — scoring inspections' : 'Standby'}</span>
            </div>
          </div>
          {fetchedAt && (
            <span className="text-caption ml-auto text-muted-foreground/70">Data as of {formatClockTime(fetchedAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[0.625rem] uppercase tracking-[0.08em] text-muted-foreground/70">{label}</span>
      <span className="text-readout text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
