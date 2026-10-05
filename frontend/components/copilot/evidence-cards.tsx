// Renders the structured, always-real part of a Copilot answer — every
// field here comes straight from RetrievalResult (backend/src/lib/copilot/retrieval.ts),
// never from the model's prose. Which of these render is decided by which
// arrays the backend actually populated for that intent, not by a switch on
// intent name, so a message never looks empty if the backend found
// something under a field this component didn't expect.

import { useState } from 'react';
import { Download, Loader2, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { classifyMineRisk, RISK_LABELS } from '@/lib/risk';
import { formatRelativeTime, humanizeEnum } from '@/lib/format';
import { getComplianceReportPdf } from '@/services/reports.service';
import { ApiError } from '@/lib/api';
import type { EvidenceRef, MineLite, RetrievalResult } from '@/types/copilot';
import { cn } from '@/lib/utils';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised/40 p-3">
      <span className="text-eyebrow text-muted-foreground">{title}</span>
      {children}
    </div>
  );
}

function riskBadge(score: number) {
  const level = classifyMineRisk(score);
  const variant = level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'success';
  return <Badge variant={variant}>{RISK_LABELS[level]}</Badge>;
}

function MinesList({ mines }: { mines: MineLite[] }) {
  if (mines.length === 0) return null;
  return (
    <Section title={`Mines (${mines.length})`}>
      <ul className="flex flex-col divide-y divide-border">
        {mines.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-1.5">
            <div className="flex min-w-0 flex-col">
              <span className="text-body truncate font-medium text-foreground">{m.name}</span>
              <span className="text-caption text-muted-foreground">{m.code}{m.region ? ` · ${m.region}` : ''}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="tabular text-sm font-semibold text-foreground">{m.complianceScore.toFixed(1)}%</span>
              {riskBadge(m.complianceScore)}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function record(r: Record<string, unknown>, key: string): unknown {
  return r[key];
}
export function str(r: Record<string, unknown>, key: string, fallback = ''): string {
  const v = record(r, key);
  return typeof v === 'string' ? v : fallback;
}
export function num(r: Record<string, unknown>, key: string): number | null {
  const v = record(r, key);
  return typeof v === 'number' ? v : null;
}

function InspectionsList({ inspections }: { inspections: Record<string, unknown>[] }) {
  if (inspections.length === 0) return null;
  return (
    <Section title={`Inspections (${inspections.length})`}>
      <ul className="flex flex-col divide-y divide-border">
        {inspections.slice(0, 8).map((i) => {
          const mine = record(i, 'mine') as Record<string, unknown> | undefined;
          const inspector = record(i, 'inspector') as Record<string, unknown> | undefined;
          const risk = num(i, 'riskScore');
          return (
            <li key={str(i, 'id')} className="flex flex-col gap-0.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body font-medium text-foreground">{mine ? str(mine, 'name') : humanizeEnum(str(i, 'type'))}</span>
                <Badge variant={str(i, 'status') === 'OVERDUE' ? 'danger' : str(i, 'status') === 'COMPLETED' ? 'success' : 'neutral'}>
                  {humanizeEnum(str(i, 'status'))}
                </Badge>
              </div>
              <span className="text-caption text-muted-foreground">
                {humanizeEnum(str(i, 'type'))} {inspector ? `· ${str(inspector, 'name')}` : ''}
                {risk !== null ? ` · AI risk ${Math.round(risk * 100)}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ViolationsList({ violations }: { violations: Record<string, unknown>[] }) {
  if (violations.length === 0) return null;
  return (
    <Section title={`Violations (${violations.length})`}>
      <ul className="flex flex-col divide-y divide-border">
        {violations.slice(0, 8).map((v) => {
          const mine = record(v, 'mine') as Record<string, unknown> | undefined;
          return (
            <li key={str(v, 'id')} className="flex flex-col gap-0.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body font-medium text-foreground">{str(v, 'code')} — {mine ? str(mine, 'name') : 'Unknown mine'}</span>
                <Badge variant={str(v, 'severity') === 'CRITICAL' ? 'danger' : str(v, 'severity') === 'MAJOR' ? 'warning' : 'neutral'}>
                  {humanizeEnum(str(v, 'severity'))}
                </Badge>
              </div>
              <span className="text-caption text-muted-foreground">{humanizeEnum(str(v, 'status'))} · {str(v, 'description')}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function AlertsList({ alerts }: { alerts: Record<string, unknown>[] }) {
  if (alerts.length === 0) return null;
  return (
    <Section title={`Alerts (${alerts.length})`}>
      <ul className="flex flex-col divide-y divide-border">
        {alerts.slice(0, 8).map((a) => {
          const mine = record(a, 'mine') as Record<string, unknown> | undefined;
          const createdAt = str(a, 'createdAt');
          return (
            <li key={str(a, 'id')} className="flex flex-col gap-0.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body font-medium text-foreground">{str(a, 'title')}</span>
                <Badge variant={str(a, 'severity') === 'CRITICAL' ? 'danger' : str(a, 'severity') === 'HIGH' ? 'warning' : 'neutral'}>
                  {str(a, 'severity')}
                </Badge>
              </div>
              <span className="text-caption text-muted-foreground">
                {humanizeEnum(str(a, 'status'))}{mine ? ` · ${str(mine, 'name')}` : ''}{createdAt ? ` · ${formatRelativeTime(createdAt)}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ReadingsList({ readings }: { readings: Record<string, unknown>[] }) {
  if (readings.length === 0) return null;
  return (
    <Section title={`Environmental readings (${readings.length})`}>
      <ul className="flex flex-col divide-y divide-border">
        {readings.slice(0, 8).map((r) => {
          const mine = record(r, 'mine') as Record<string, unknown> | undefined;
          const exceeded = record(r, 'exceededAt') !== null && record(r, 'exceededAt') !== undefined;
          return (
            <li key={str(r, 'id')} className="flex items-center justify-between gap-2 py-1.5">
              <div className="flex min-w-0 flex-col">
                <span className="text-body font-medium text-foreground">{str(r, 'parameter')}{mine ? ` — ${str(mine, 'name')}` : ''}</span>
                <span className="text-caption text-muted-foreground">{num(r, 'value')} {str(r, 'unit')}{num(r, 'threshold') !== null ? ` (threshold ${num(r, 'threshold')})` : ''}</span>
              </div>
              {exceeded && (
                <Badge variant="danger" className="shrink-0">
                  <TriangleAlert className="h-3 w-3" /> Exceeded
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ReportsList({ reports }: { reports: Record<string, unknown>[] }) {
  if (reports.length === 0) return null;
  return (
    <Section title={`Reports (${reports.length})`}>
      <ul className="flex flex-col divide-y divide-border">
        {reports.slice(0, 8).map((r) => {
          const mine = record(r, 'mine') as Record<string, unknown> | undefined;
          return (
            <li key={str(r, 'id')} className="flex items-center justify-between gap-2 py-1.5">
              <div className="flex min-w-0 flex-col">
                <span className="text-body truncate font-medium text-foreground">{str(r, 'title')}</span>
                <span className="text-caption text-muted-foreground">{mine ? str(mine, 'name') : ''}</span>
              </div>
              <Badge variant={str(r, 'status') === 'APPROVED' ? 'success' : str(r, 'status') === 'REJECTED' ? 'danger' : 'gold'}>
                {humanizeEnum(str(r, 'status'))}
              </Badge>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const SUMMARY_LABELS: Record<string, string> = {
  minesTotal: 'Mines',
  activeMines: 'Active mines',
  avgCompliance: 'Avg. compliance',
  inspectionsTotal: 'Inspections',
  inspectionsOverdue: 'Overdue inspections',
  inspectionsCompleted: 'Completed inspections',
  alertsOpen: 'Open alerts',
  alertsCritical: 'Critical alerts',
  violationsOpen: 'Open violations',
  violationsCritical: 'Critical violations',
  reportsAwaiting: 'Reports awaiting approval',
  reportsAwaitingApproval: 'Reports awaiting approval',
};

function SummaryStats({ summary }: { summary: Record<string, number> }) {
  const entries = Object.entries(summary).filter(([k]) => k !== 'windowDays');
  if (entries.length === 0) return null;
  return (
    <Section title="Compliance summary">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <span className="text-caption text-muted-foreground">{SUMMARY_LABELS[key] ?? humanizeEnum(key)}</span>
            <span className="tabular text-sm font-semibold text-foreground">
              {key === 'avgCompliance' ? (value < 0 ? '—' : `${value.toFixed(1)}%`) : value}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TimelineList({ timeline }: { timeline: { label: string; value: number }[] }) {
  if (timeline.length === 0) return null;
  return (
    <Section title="Safety timeline">
      <ul className="flex flex-col gap-1.5">
        {timeline.map((t) => (
          <li key={t.label} className="flex items-center justify-between text-body">
            <span className="text-foreground/90">{t.label}</span>
            <span className="tabular font-semibold text-foreground">{t.value}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function MineDetailCard({ mineDetail }: { mineDetail: Record<string, unknown> }) {
  const overview = record(mineDetail, 'overview') as Record<string, unknown> | undefined;
  const risk = record(mineDetail, 'risk') as Record<string, unknown> | undefined;
  const openActions = record(mineDetail, 'openActions') as Record<string, unknown> | undefined;
  const environment = record(mineDetail, 'environment') as Record<string, unknown> | undefined;
  const compliance = record(mineDetail, 'compliance') as Record<string, unknown> | null | undefined;

  if (!overview && !risk) return null;

  return (
    <Section title="Mine intelligence profile">
      <div className="flex flex-col gap-2.5">
        {overview && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-title text-foreground">{str(overview, 'name')}</span>
            <span className="text-caption text-muted-foreground">{str(overview, 'code')}{overview.region ? ` · ${str(overview, 'region')}` : ''}</span>
            <Badge variant="neutral">{str(overview, 'status')}</Badge>
          </div>
        )}
        {risk && typeof num(risk, 'complianceScore') === 'number' && (
          <div className="flex items-center gap-2">
            <span className="tabular text-2xl font-semibold text-foreground">{num(risk, 'complianceScore')!.toFixed(1)}%</span>
            {riskBadge(num(risk, 'complianceScore')!)}
          </div>
        )}
        {openActions && (
          <div className="grid grid-cols-3 gap-2 border-t border-border pt-2">
            <div className="flex flex-col">
              <span className="text-caption text-muted-foreground">Overdue</span>
              <span className="tabular text-sm font-semibold text-foreground">{num(openActions, 'overdueInspections') ?? 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-caption text-muted-foreground">Open alerts</span>
              <span className="tabular text-sm font-semibold text-foreground">{num(openActions, 'openAlerts') ?? 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-caption text-muted-foreground">Open violations</span>
              <span className="tabular text-sm font-semibold text-foreground">{num(openActions, 'openViolations') ?? 0}</span>
            </div>
          </div>
        )}
        {environment && typeof num(environment, 'exceededCount') === 'number' && num(environment, 'exceededCount')! > 0 && (
          <p className="text-caption flex items-center gap-1.5 text-danger">
            <TriangleAlert className="h-3.5 w-3.5" /> {num(environment, 'exceededCount')} environmental reading(s) exceeded threshold.
          </p>
        )}
        {compliance !== undefined && compliance !== null && (
          <p className="text-caption text-muted-foreground">
            Reports: {num(compliance, 'approved') ?? 0} approved, {num(compliance, 'pendingApproval') ?? 0} awaiting approval, of {num(compliance, 'total') ?? 0} total.
          </p>
        )}
      </div>
    </Section>
  );
}

function ReportActionCard({ mineId, mineName }: { mineId: string; mineName: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function download() {
    setState('loading');
    try {
      const blob = await getComplianceReportPdf(mineId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PRAHARI_${mineName.replace(/[^A-Za-z0-9_-]/g, '_')}_compliance_report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState('idle');
    } catch (err) {
      setState('error');
      console.error(err instanceof ApiError ? err.message : err);
    }
  }

  return (
    <Section title="Compliance report">
      <div className="flex items-center justify-between gap-3">
        <span className="text-body text-foreground/90">Statutory compliance report for {mineName}</span>
        <button
          type="button"
          onClick={download}
          disabled={state === 'loading'}
          className={cn(
            'inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-60',
          )}
        >
          {state === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {state === 'loading' ? 'Generating…' : 'Download PDF'}
        </button>
      </div>
      {state === 'error' && <p className="text-caption text-danger">Couldn&apos;t generate the report. Try again.</p>}
    </Section>
  );
}

function EvidenceTrail({ evidence }: { evidence: EvidenceRef[] }) {
  if (evidence.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      <span className="text-[0.625rem] uppercase tracking-[0.06em] text-muted-foreground/60">Sources:</span>
      {evidence.slice(0, 6).map((e) => (
        <span
          key={`${e.type}-${e.id}`}
          className="text-[0.625rem] rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground ring-1 ring-inset ring-border-strong"
        >
          {e.label}
        </span>
      ))}
    </div>
  );
}

export function EvidenceCards({ retrieval }: { retrieval: RetrievalResult }) {
  return (
    <div className="flex flex-col gap-2.5">
      {retrieval.deniedReason && (
        <p className="text-caption flex items-center gap-2 rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-danger">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {retrieval.deniedReason}
        </p>
      )}
      {retrieval.notes.map((note, i) => (
        <p key={i} className="text-caption text-muted-foreground/80">{note}</p>
      ))}
      {retrieval.mineDetail && <MineDetailCard mineDetail={retrieval.mineDetail} />}
      {retrieval.reportAction && <ReportActionCard mineId={retrieval.reportAction.mineId} mineName={retrieval.reportAction.mineName} />}
      <MinesList mines={retrieval.mines} />
      <InspectionsList inspections={retrieval.inspections} />
      <ViolationsList violations={retrieval.violations} />
      <AlertsList alerts={retrieval.alerts} />
      <ReadingsList readings={retrieval.readings} />
      <ReportsList reports={retrieval.reports} />
      {retrieval.summary && <SummaryStats summary={retrieval.summary} />}
      {retrieval.timeline && <TimelineList timeline={retrieval.timeline} />}
      <EvidenceTrail evidence={retrieval.evidence} />
    </div>
  );
}
