// The Command Center's centerpiece visualisation. The backend's Mine model
// has no latitude/longitude — only a free-text `location` and `region`
// string — so rather than inventing coordinates to fake a literal map, this
// groups the real mines by their real `region` field into a tactical grid of
// zone tiles: each tile's mine count, average compliance, and risk colour
// are all genuine aggregates of the fetched Mine[]. A zone pulses when one of
// its mines appears in the live alerts feed. Explicitly schematic, not
// cartographic — the caption says so.

import { AlertTriangle, MapPinned } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from './empty-state';
import { classifyMineRisk, RISK_LABELS, type RiskLevel } from '@/lib/risk';
import { cn } from '@/lib/utils';
import type { Mine, AlertWithRelations } from '@/types/models';

const ZONE_TONE: Record<RiskLevel, { ring: string; dot: string; text: string }> = {
  high: { ring: 'ring-danger/40 hover:border-danger/60', dot: 'bg-danger', text: 'text-danger' },
  medium: { ring: 'ring-warning/30 hover:border-warning/50', dot: 'bg-warning', text: 'text-warning' },
  low: { ring: 'ring-success/25 hover:border-success/45', dot: 'bg-success', text: 'text-success' },
};

type Zone = {
  name: string;
  mines: Mine[];
  avgCompliance: number;
  level: RiskLevel;
  alerting: boolean;
};

function buildZones(mines: Mine[], alerts: AlertWithRelations[] | null): Zone[] {
  const alertingMineIds = new Set((alerts ?? []).map((a) => a.mine?.id).filter(Boolean));

  const byRegion = new Map<string, Mine[]>();
  for (const mine of mines) {
    const key = mine.region?.trim() || 'Unclassified';
    if (!byRegion.has(key)) byRegion.set(key, []);
    byRegion.get(key)!.push(mine);
  }

  return Array.from(byRegion.entries())
    .map(([name, zoneMines]) => {
      const avgCompliance = zoneMines.reduce((s, m) => s + m.complianceScore, 0) / zoneMines.length;
      return {
        name,
        mines: zoneMines,
        avgCompliance,
        level: classifyMineRisk(avgCompliance),
        alerting: zoneMines.some((m) => alertingMineIds.has(m.id)),
      };
    })
    .sort((a, b) => a.avgCompliance - b.avgCompliance);
}

export function CoalfieldMap({ mines, alerts }: { mines: Mine[] | null; alerts: AlertWithRelations[] | null }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <MapPinned className="h-4 w-4 text-primary-soft" aria-hidden />
            Coalfield Risk Map
          </CardTitle>
          <CardDescription>Mining zones grouped by region · schematic layout, not to scale</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {mines === null ? (
          <EmptyState icon={MapPinned} tone="danger" message="Couldn't load mine data. Try refreshing." />
        ) : mines.length === 0 ? (
          <EmptyState icon={MapPinned} message="No mines to map yet." />
        ) : (
          <div className="relative rounded-lg border border-border bg-tactical-grid p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {buildZones(mines, alerts).map((zone) => {
                const tone = ZONE_TONE[zone.level];
                return (
                  <div
                    key={zone.name}
                    className={cn(
                      'hover-lift relative flex flex-col gap-2 rounded-lg border border-border bg-card/80 p-3 ring-1 ring-inset backdrop-blur-sm',
                      tone.ring,
                    )}
                  >
                    {zone.alerting && (
                      <span
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-danger-foreground animate-pulse-ring"
                        style={{ '--pulse-color': 'oklch(0.655 0.185 25 / 45%)' } as React.CSSProperties}
                        title="Active alert in this zone"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden />
                      <span className="text-caption truncate font-medium text-foreground">{zone.name}</span>
                    </div>

                    <span className={cn('text-metric tabular', tone.text)}>{zone.avgCompliance.toFixed(0)}%</span>

                    <div className="flex items-center justify-between">
                      <span className="text-[0.625rem] uppercase tracking-[0.06em] text-muted-foreground">
                        {zone.mines.length} {zone.mines.length === 1 ? 'mine' : 'mines'}
                      </span>
                      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                        {RISK_LABELS[zone.level]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
