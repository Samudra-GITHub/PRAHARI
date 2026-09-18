'use client';

import { useState } from 'react';
import { Mountain } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from './empty-state';
import { classifyMineRisk, RISK_LABELS, RISK_THRESHOLDS, type RiskLevel } from '@/lib/risk';
import type { Mine } from '@/types/models';
import { cn } from '@/lib/utils';

const LEVEL_FILL: Record<RiskLevel, string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-success',
};

const LEVEL_VAR: Record<RiskLevel, string> = {
  high: 'var(--danger)',
  medium: 'var(--warning)',
  low: 'var(--success)',
};

const LEVEL_BADGE: Record<RiskLevel, 'danger' | 'warning' | 'success'> = {
  high: 'danger',
  medium: 'warning',
  low: 'success',
};

const LEVELS: RiskLevel[] = ['high', 'medium', 'low'];

const SIZE = 168;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RiskDistribution({ mines }: { mines: Mine[] | null }) {
  const [hovered, setHovered] = useState<RiskLevel | null>(null);

  if (mines === null || mines.length === 0) {
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Mine Risk Distribution</CardTitle>
          <CardDescription>Banded by compliance score</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          {mines === null ? (
            <EmptyState icon={Mountain} tone="danger" message="Couldn't load mine data. Try refreshing." />
          ) : (
            <EmptyState icon={Mountain} message="No mines to assess yet." />
          )}
        </CardContent>
      </Card>
    );
  }

  const byLevel: Record<RiskLevel, Mine[]> = { high: [], medium: [], low: [] };
  for (const mine of mines) byLevel[classifyMineRisk(mine.complianceScore)].push(mine);

  const total = mines.length;
  const lowest = mines.slice().sort((a, b) => a.complianceScore - b.complianceScore);

  // Build donut segments as stroke-dasharray offsets around the ring —
  // reduce (not a mutated loop variable) so each render is a pure function
  // of `byLevel`.
  const segments = LEVELS.filter((level) => byLevel[level].length > 0).reduce<
    { level: RiskLevel; dash: number; offset: number; fraction: number }[]
  >((acc, level) => {
    const fraction = byLevel[level].length / total;
    const dash = fraction * CIRCUMFERENCE;
    const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    return [...acc, { level, dash, offset, fraction }];
  }, []);

  const centerLevel = hovered ?? (byLevel.high.length > 0 ? 'high' : byLevel.medium.length > 0 ? 'medium' : 'low');

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Mine Risk Distribution</CardTitle>
        <CardDescription>
          Banded by compliance score · high &lt;{RISK_THRESHOLDS.HIGH_MAX} · medium &lt;{RISK_THRESHOLDS.MEDIUM_MAX} ·
          low ≥{RISK_THRESHOLDS.MEDIUM_MAX}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="flex items-center justify-center gap-6 sm:justify-start">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
              <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
              {segments.map((seg) => (
                <circle
                  key={seg.level}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={LEVEL_VAR[seg.level]}
                  strokeWidth={STROKE}
                  strokeDasharray={`${seg.dash} ${CIRCUMFERENCE - seg.dash}`}
                  strokeDashoffset={-seg.offset}
                  strokeLinecap="butt"
                  className="cursor-pointer transition-opacity duration-150"
                  style={{ opacity: hovered && hovered !== seg.level ? 0.35 : 1 }}
                  onMouseEnter={() => setHovered(seg.level)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="tabular text-2xl font-semibold text-foreground">{byLevel[centerLevel].length}</span>
              <span className="text-caption text-muted-foreground">{RISK_LABELS[centerLevel]}</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            {LEVELS.map((level) => {
              const count = byLevel[level].length;
              const pct = Math.round((count / total) * 100);
              return (
                <button
                  key={level}
                  type="button"
                  onMouseEnter={() => setHovered(level)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(level)}
                  onBlur={() => setHovered(null)}
                  className={cn(
                    '-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1 text-left transition-colors duration-150',
                    hovered === level ? 'bg-surface-raised' : 'hover:bg-surface-raised',
                  )}
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', LEVEL_FILL[level])} aria-hidden />
                  <span className="text-caption min-w-16 truncate text-muted-foreground">{RISK_LABELS[level]}</span>
                  <span className="tabular text-sm font-semibold text-foreground">{count}</span>
                  <span className="tabular text-caption text-muted-foreground">{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lowest-scoring mines first — the ones that need attention. */}
        <div className="flex flex-col gap-px border-t border-border pt-4">
          <span className="text-eyebrow pb-2 text-muted-foreground/70">Lowest scoring</span>
          {lowest.slice(0, 5).map((mine) => {
            const level = classifyMineRisk(mine.complianceScore);
            return (
              <div
                key={mine.id}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-surface-raised"
              >
                <span className="text-body min-w-0 flex-1 truncate text-foreground">{mine.name}</span>
                <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                  <div
                    className={cn('h-full rounded-full', LEVEL_FILL[level])}
                    style={{ width: `${Math.min(100, Math.max(0, mine.complianceScore))}%` }}
                  />
                </div>
                <span className="tabular text-caption w-12 shrink-0 text-right font-medium text-foreground">
                  {mine.complianceScore.toFixed(1)}
                </span>
                <Badge variant={LEVEL_BADGE[level]} className="w-[5.25rem] justify-center">
                  {RISK_LABELS[level]}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
