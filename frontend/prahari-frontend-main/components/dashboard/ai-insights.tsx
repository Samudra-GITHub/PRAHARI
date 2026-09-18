import { BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deriveInsights, type InsightTone } from '@/lib/insights';
import { cn } from '@/lib/utils';
import type { DashboardData } from '@/hooks/use-dashboard-data';
import type { DashboardSnapshot } from '@/lib/insights';

const TONE_CLASSES: Record<InsightTone, string> = {
  critical: 'border-danger/25 bg-danger/5',
  warning: 'border-warning/25 bg-warning/5',
  success: 'border-success/20 bg-success/5',
  neutral: 'border-border bg-surface-raised/30',
};

const TONE_ICON: Record<InsightTone, string> = {
  critical: 'bg-danger/12 text-danger ring-danger/25',
  warning: 'bg-warning/12 text-warning ring-warning/25',
  success: 'bg-success/12 text-success ring-success/25',
  neutral: 'bg-muted text-muted-foreground ring-border-strong',
};

export function AiInsights({ data, history }: { data: DashboardData; history: DashboardSnapshot[] }) {
  const insights = deriveInsights(data, history);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary-soft" aria-hidden />
          AI Safety Insights
        </CardTitle>
        <CardDescription>Rule-based findings derived from live compliance data — no fabricated statistics</CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight) => {
          const Icon = insight.icon;
          return (
            <div key={insight.id} className={cn('flex flex-col gap-2.5 rounded-lg border p-4', TONE_CLASSES[insight.tone])}>
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset',
                  TONE_ICON[insight.tone],
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-subtitle text-foreground">{insight.title}</span>
                <span className="text-caption text-muted-foreground">{insight.detail}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
