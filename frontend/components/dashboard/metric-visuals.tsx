// Small, self-contained SVG visualisations composed into the four Command
// Center metric panels (kpi-grid.tsx) — each panel gets a distinct
// "personality" built from the same real numbers already on DashboardData,
// no charting library required.

import { cn } from '@/lib/utils';
import { classifyMineRisk } from '@/lib/risk';
import type { Mine } from '@/types/models';

const RISK_DOT: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-success',
};

// Full ring gauge — used for Compliance Score.
export function RingGauge({
  percent,
  colorVar,
  size = 56,
  strokeWidth = 5,
}: {
  percent: number;
  colorVar: string;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colorVar}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  );
}

// Semi-circle "aircraft instrument" arc — used for Overdue Inspections
// (completed / total) and the compliance health panel.
export function ArcGauge({
  percent,
  colorVar,
  size = 96,
  strokeWidth = 8,
}: {
  percent: number;
  colorVar: string;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg width={size} height={size / 2 + strokeWidth / 2} viewBox={`0 0 ${size} ${size / 2 + strokeWidth / 2}`} aria-hidden>
      <path
        d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
        fill="none"
        stroke={colorVar}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  );
}

// A grid of one square per real mine, coloured by its real compliance band —
// used for High-Risk Mines. Caps the rendered squares so a large portfolio
// doesn't overflow the card; the overflow count is shown, not dropped.
export function HeatGrid({ mines, max = 24 }: { mines: Mine[]; max?: number }) {
  const shown = mines.slice(0, max);
  const overflow = mines.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1" role="img" aria-label={`${mines.length} mines by risk band`}>
      {shown.map((mine) => (
        <span
          key={mine.id}
          title={`${mine.name} — ${mine.complianceScore.toFixed(1)}%`}
          className={cn('h-2.5 w-2.5 rounded-[2px]', RISK_DOT[classifyMineRisk(mine.complianceScore)])}
        />
      ))}
      {overflow > 0 && <span className="text-caption tabular pl-1 text-muted-foreground">+{overflow}</span>}
    </div>
  );
}

// A row of dots for open alerts — critical ones pulse red, the rest sit
// quietly gold. Used for Active Alerts.
export function PulseStack({ total, critical, max = 12 }: { total: number; critical: number; max?: number }) {
  if (total === 0) {
    return <div className="text-caption text-muted-foreground/60">No open alerts</div>;
  }

  const shown = Math.min(total, max);
  const overflow = total - shown;
  const dots = Array.from({ length: shown }, (_, i) => i < critical);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="img" aria-label={`${total} open alerts, ${critical} critical`}>
      {dots.map((isCritical, i) => (
        <span
          key={i}
          className={cn(
            'h-2 w-2 rounded-full',
            isCritical ? 'animate-pulse-ring bg-danger' : 'bg-gold/70',
          )}
          style={isCritical ? ({ '--pulse-color': 'oklch(0.655 0.185 25 / 45%)' } as React.CSSProperties) : undefined}
        />
      ))}
      {overflow > 0 && <span className="text-caption tabular text-muted-foreground">+{overflow}</span>}
    </div>
  );
}
