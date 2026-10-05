import { MessageSquarePlus, Trash2, Bot } from 'lucide-react';
import { QuickPrompts } from './quick-prompts';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CopilotSession } from '@/types/copilot';

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onPickPrompt,
}: {
  sessions: CopilotSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onPickPrompt: (prompt: string) => void;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto border-r border-border bg-card p-4">
      <button
        type="button"
        onClick={onNew}
        className="flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
      >
        <MessageSquarePlus className="h-4 w-4" /> New conversation
      </button>

      <div className="flex flex-col gap-2">
        <span className="text-eyebrow text-muted-foreground">Quick prompts</span>
        <QuickPrompts onPick={onPickPrompt} compact />
      </div>

      <div className="flex flex-1 flex-col gap-1 border-t border-border pt-3">
        <span className="text-eyebrow pb-1 text-muted-foreground">Conversations</span>
        {sessions.length === 0 && <p className="text-caption text-muted-foreground/70">No conversations yet.</p>}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={cn(
              'group flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors duration-150',
              s.id === activeId ? 'bg-selected' : 'hover:bg-surface-raised',
            )}
          >
            <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <button type="button" onClick={() => onSelect(s.id)} className="flex min-w-0 flex-1 flex-col items-start text-left">
              <span className="text-body w-full truncate text-foreground">{s.title}</span>
              <span className="text-caption text-muted-foreground/70">{formatRelativeTime(s.updatedAt)}</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              aria-label="Delete conversation"
              className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/12 hover:text-danger group-hover:flex"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-[0.625rem] leading-4 tracking-[0.06em] text-muted-foreground/40 uppercase">
        Conversations are stored on this device only.
      </p>
    </div>
  );
}
