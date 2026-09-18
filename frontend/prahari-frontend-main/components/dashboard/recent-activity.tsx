'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ClipboardList, Bell, ChevronDown, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from './empty-state';
import { formatRelativeTime, humanizeEnum } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InspectionWithRelations, AlertWithRelations } from '@/types/models';
import type { AlertSeverity, InspectionStatus } from '@/types/enums';
import type { ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'primary' | 'gold' | 'success' | 'warning' | 'danger';

const INSPECTION_STATUS_VARIANT: Record<InspectionStatus, BadgeVariant> = {
  SCHEDULED: 'neutral',
  IN_PROGRESS: 'gold',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  OVERDUE: 'danger',
};

const INSPECTION_STATUS_STRIP: Record<InspectionStatus, string> = {
  SCHEDULED: 'bg-muted-foreground/40',
  IN_PROGRESS: 'bg-gold',
  COMPLETED: 'bg-success',
  CANCELLED: 'bg-muted-foreground/40',
  OVERDUE: 'bg-danger',
};

// Four distinct steps so severity is readable at a glance: grey → brass →
// amber → red. LOW and MEDIUM deliberately stay quiet.
const ALERT_SEVERITY_VARIANT: Record<AlertSeverity, BadgeVariant> = {
  LOW: 'neutral',
  MEDIUM: 'gold',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const ALERT_SEVERITY_STRIP: Record<AlertSeverity, string> = {
  LOW: 'bg-muted-foreground/40',
  MEDIUM: 'bg-gold',
  HIGH: 'bg-warning',
  CRITICAL: 'bg-danger',
};

function AiBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-primary-soft ring-1 ring-inset ring-primary/25">
      <Sparkles className="h-2.5 w-2.5" aria-hidden />
      {label}
    </span>
  );
}

function IncidentRow({
  stripClassName,
  title,
  detail,
  timestamp,
  badge,
  aiLabel,
  expandable,
}: {
  stripClassName: string;
  title: string;
  detail: string;
  timestamp: string;
  badge: { label: string; variant: BadgeVariant };
  aiLabel?: string;
  expandable?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="relative">
      <div
        className={cn(
          'flex items-start gap-3 rounded-md py-2.5 pl-3 pr-2 transition-colors duration-150 hover:bg-surface-raised',
        )}
      >
        <span className={cn('mt-0.5 h-full min-h-8 w-0.5 shrink-0 self-stretch rounded-full', stripClassName)} aria-hidden />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-body truncate font-medium text-foreground">{title}</span>
            {aiLabel && <AiBadge label={aiLabel} />}
          </div>
          <span className="text-caption truncate text-muted-foreground">{detail}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-caption tabular hidden text-muted-foreground/70 sm:block">{timestamp}</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {expandable && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-[background-color,transform] duration-150 hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {expandable && expanded && (
        <div className="ml-[1.375rem] mb-1 mr-2 rounded-md border border-border bg-surface-raised/50 px-3 py-2.5">
          {expandable}
        </div>
      )}
    </li>
  );
}

function Column({
  icon,
  title,
  failedMessage,
  emptyMessage,
  count,
  children,
  divided = false,
}: {
  icon: LucideIcon;
  title: string;
  failedMessage: string;
  emptyMessage: string;
  // null = failed to load
  count: number | null;
  children: ReactNode;
  divided?: boolean;
}) {
  const Icon = icon;
  return (
    <section className={divided ? 'flex flex-col gap-3 lg:border-l lg:border-border lg:pl-8' : 'flex flex-col gap-3'}>
      <h3 className="text-eyebrow flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {title}
      </h3>
      {count === null ? (
        <EmptyState icon={icon} tone="danger" message={failedMessage} />
      ) : count === 0 ? (
        <EmptyState icon={icon} message={emptyMessage} />
      ) : (
        <ul className="flex flex-col">{children}</ul>
      )}
    </section>
  );
}

export function RecentActivity({
  inspections,
  alerts,
}: {
  inspections: InspectionWithRelations[] | null;
  alerts: AlertWithRelations[] | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Incident Feed</CardTitle>
        <CardDescription>Latest inspections and alerts, most recently updated first</CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
        <Column
          icon={ClipboardList}
          title="Inspections"
          count={inspections?.length ?? null}
          failedMessage="Couldn't load inspections."
          emptyMessage="No recent inspections."
        >
          {inspections?.map((insp) => (
            <IncidentRow
              key={insp.id}
              stripClassName={INSPECTION_STATUS_STRIP[insp.status]}
              title={insp.mine.name}
              detail={`${humanizeEnum(insp.type)} inspection · ${insp.inspector.name}`}
              timestamp={formatRelativeTime(insp.updatedAt)}
              badge={{ label: humanizeEnum(insp.status), variant: INSPECTION_STATUS_VARIANT[insp.status] }}
              aiLabel={insp.riskScore !== null ? `AI risk ${Math.round(insp.riskScore)}` : undefined}
              expandable={
                insp.summary || insp.riskReasons.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {insp.summary && <p className="text-caption text-foreground/90">{insp.summary}</p>}
                    {insp.riskReasons.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {insp.riskReasons.map((reason, i) => (
                          <li key={i} className="text-caption flex items-start gap-1.5 text-muted-foreground">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-soft" aria-hidden />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : undefined
              }
            />
          ))}
        </Column>

        {/* Divider only once the columns sit side by side. */}
        <Column
          icon={Bell}
          title="Alerts"
          count={alerts?.length ?? null}
          failedMessage="Couldn't load alerts."
          emptyMessage="No recent alerts."
          divided
        >
          {alerts?.map((alert) => (
            <IncidentRow
              key={alert.id}
              stripClassName={ALERT_SEVERITY_STRIP[alert.severity]}
              title={alert.title}
              detail={`${humanizeEnum(alert.status)} · ${alert.mine?.name ?? 'System-wide'}`}
              timestamp={formatRelativeTime(alert.createdAt)}
              badge={{ label: alert.severity, variant: ALERT_SEVERITY_VARIANT[alert.severity] }}
              aiLabel={alert.type === 'HIGH_AI_RISK' ? 'AI flagged' : undefined}
              expandable={
                <div className="flex flex-col gap-1.5">
                  <p className="text-caption text-foreground/90">{alert.message}</p>
                  {alert.assignedTo && (
                    <p className="text-caption text-muted-foreground">Assigned to {alert.assignedTo.name}</p>
                  )}
                </div>
              }
            />
          ))}
        </Column>
      </CardContent>
    </Card>
  );
}
