// The right-hand "Live Mine Context" rail. Derives entirely from retrieval
// data already attached to messages in this conversation — no separate
// fetch. It re-renders as the conversation moves from mine to mine because
// it always looks at the most recent message that actually resolved one.

import { Radar, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { classifyMineRisk, RISK_LABELS } from '@/lib/risk';
import { humanizeEnum } from '@/lib/format';
import { record, str, num } from './evidence-cards';
import type { CopilotMessage } from '@/types/copilot';

function findLatestMineDetail(messages: CopilotMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const r = messages[i].retrieval;
    if (r?.mineDetail) return r.mineDetail;
  }
  return null;
}

function findLatestMinesList(messages: CopilotMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const r = messages[i].retrieval;
    if (r?.mines && r.mines.length > 0) return r.mines;
  }
  return [];
}

export function MineContextPanel({ messages }: { messages: CopilotMessage[] }) {
  const mineDetail = findLatestMineDetail(messages);
  const mines = mineDetail ? [] : findLatestMinesList(messages);

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto border-l border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Radar className="h-4 w-4 text-primary-soft" aria-hidden />
        <span className="text-eyebrow text-muted-foreground">Live mine context</span>
      </div>

      {!mineDetail && mines.length === 0 && (
        <p className="text-caption text-muted-foreground/70">Ask about a mine — its risk, compliance, and latest alerts will appear here.</p>
      )}

      {mineDetail && <MineDetailPanel mineDetail={mineDetail} />}

      {!mineDetail && mines.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-caption text-muted-foreground">In this conversation</span>
          <ul className="flex flex-col divide-y divide-border">
            {mines.slice(0, 6).map((m) => {
              const level = classifyMineRisk(m.complianceScore);
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-body truncate font-medium text-foreground">{m.name}</span>
                    <span className="text-caption text-muted-foreground">{m.code}</span>
                  </div>
                  <span className="tabular text-sm font-semibold text-foreground">{m.complianceScore.toFixed(1)}%</span>
                  <Badge variant={level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'success'}>
                    {RISK_LABELS[level]}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function MineDetailPanel({ mineDetail }: { mineDetail: Record<string, unknown> }) {
  const overview = record(mineDetail, 'overview') as Record<string, unknown> | undefined;
  const risk = record(mineDetail, 'risk') as Record<string, unknown> | undefined;
  const openActions = record(mineDetail, 'openActions') as Record<string, unknown> | undefined;
  const environment = record(mineDetail, 'environment') as Record<string, unknown> | undefined;
  const complianceScore = risk ? num(risk, 'complianceScore') : null;
  const level = complianceScore !== null ? classifyMineRisk(complianceScore) : null;

  return (
    <div className="flex flex-col gap-4">
      {overview && (
        <div className="flex flex-col gap-1">
          <span className="text-title text-foreground">{str(overview, 'name')}</span>
          <span className="text-caption text-muted-foreground">{str(overview, 'code')}{overview.region ? ` · ${str(overview, 'region')}` : ''}</span>
        </div>
      )}

      {complianceScore !== null && level && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised/40 p-3">
          <span className="text-eyebrow text-muted-foreground">Compliance score</span>
          <div className="flex items-center gap-2">
            <span className="tabular text-3xl font-semibold text-foreground">{complianceScore.toFixed(1)}%</span>
            <Badge variant={level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'success'}>{RISK_LABELS[level]}</Badge>
          </div>
        </div>
      )}

      {openActions && (
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow text-muted-foreground">Open actions</span>
          <Row label="Overdue inspections" value={num(openActions, 'overdueInspections') ?? 0} danger={(num(openActions, 'overdueInspections') ?? 0) > 0} />
          <Row label="Open alerts" value={num(openActions, 'openAlerts') ?? 0} danger={(num(openActions, 'openAlerts') ?? 0) > 0} />
          <Row label="Open violations" value={num(openActions, 'openViolations') ?? 0} danger={(num(openActions, 'openViolations') ?? 0) > 0} />
        </div>
      )}

      {environment && (
        <div className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-muted-foreground">Environmental snapshot</span>
          {(num(environment, 'exceededCount') ?? 0) > 0 ? (
            <p className="text-caption flex items-center gap-1.5 text-danger">
              <TriangleAlert className="h-3.5 w-3.5" /> {num(environment, 'exceededCount')} reading(s) over threshold
            </p>
          ) : (
            <p className="text-caption text-muted-foreground">No exceedances in the latest readings.</p>
          )}
        </div>
      )}

      {overview && (
        <div className="flex flex-col gap-1">
          <span className="text-eyebrow text-muted-foreground">Status</span>
          <Badge variant="neutral" className="w-fit">{humanizeEnum(str(overview, 'status'))}</Badge>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between text-body">
      <span className="text-foreground/80">{label}</span>
      <span className={`tabular font-semibold ${danger ? 'text-warning' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
