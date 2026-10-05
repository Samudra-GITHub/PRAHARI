import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Sparkline } from './sparkline';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';

export type KpiTone = 'good' | 'warning' | 'critical' | 'neutral';

const TONE_TEXT: Record<KpiTone, string> = {
  good: 'text-foreground',
  warning: 'text-warning',
  critical: 'text-danger',
  neutral: 'text-foreground',
};

const TONE_VAR: Record<KpiTone, string> = {
  good: 'var(--primary-soft)',
  warning: 'var(--warning)',
  critical: 'var(--danger)',
  neutral: 'var(--muted-foreground)',
};

const TONE_BADGE_ICON: Record<KpiTone, string> = {
  good: 'bg-primary/15 text-primary-soft ring-primary/25',
  warning: 'bg-warning/12 text-warning ring-warning/25',
  critical: 'bg-danger/12 text-danger ring-danger/25',
  neutral: 'bg-muted text-muted-foreground ring-border-strong',
};

const TONE_RAIL: Record<KpiTone, string> = {
  good: 'bg-transparent',
  warning: 'bg-warning/35',
  critical: 'bg-danger/80',
  neutral: 'bg-transparent',
};

const TONE_CHIP: Record<KpiTone, { label: string; className: string }> = {
  good: { label: 'Nominal', className: 'bg-success/12 text-success ring-success/25' },
  warning: { label: 'Watch', className: 'bg-warning/12 text-warning ring-warning/25' },
  critical: { label: 'Critical', className: 'bg-danger/12 text-danger ring-danger/25' },
  neutral: { label: 'Standby', className: 'bg-muted text-muted-foreground ring-border-strong' },
};

export type Trend = { direction: 'up' | 'down' | 'flat'; label: string; good: boolean };

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };

export function MetricPanel({
  label,
  icon: Icon,
  tone = 'neutral',
  numericValue,
  formatValue,
  subtext,
  trend,
  visualization,
  sparklineValues,
}: {
  label: string;
  icon: LucideIcon;
  tone?: KpiTone;
  numericValue: number | null;
  formatValue: (n: number) => string;
  subtext?: string;
  trend?: Trend;
  visualization?: ReactNode;
  sparklineValues?: (number | null)[];
}) {
  const animated = useCountUp(numericValue ?? 0);
  const chip = TONE_CHIP[tone];
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;

  return (
    <Card className="hover-lift relative flex flex-col gap-3 overflow-hidden p-5">
      <span className={cn('absolute inset-x-0 top-0 h-0.5', TONE_RAIL[tone])} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <span className="text-eyebrow text-muted-foreground">{label}</span>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
            TONE_BADGE_ICON[tone],
          )}
        >
          <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <span className={cn('text-metric-lg', TONE_TEXT[tone])}>
          {numericValue === null ? '—' : formatValue(animated)}
        </span>
        {sparklineValues && <Sparkline values={sparklineValues} colorVar={TONE_VAR[tone]} />}
      </div>

      {visualization && <div>{visualization}</div>}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {TrendIcon && (
            <TrendIcon
              className={cn('h-3 w-3 shrink-0', trend!.good ? 'text-success' : trend!.direction === 'flat' ? 'text-muted-foreground' : 'text-warning')}
              aria-hidden
            />
          )}
          <span className="text-caption truncate text-muted-foreground">{trend?.label ?? subtext}</span>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.06em] ring-1 ring-inset',
            chip.className,
          )}
        >
          {chip.label}
        </span>
      </div>
    </Card>
  );
}
