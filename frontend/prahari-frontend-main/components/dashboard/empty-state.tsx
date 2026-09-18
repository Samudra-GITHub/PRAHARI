import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// `danger` is for a section whose data failed to load — distinct from a
// section that loaded fine and is genuinely empty.
export function EmptyState({
  icon: Icon,
  message,
  tone = 'neutral',
}: {
  icon: LucideIcon;
  message: string;
  tone?: 'neutral' | 'danger';
}) {
  const danger = tone === 'danger';
  return (
    <div
      role={danger ? 'alert' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center',
        danger ? 'border-danger/30 bg-danger/5' : 'border-border',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset',
          danger ? 'bg-danger/12 text-danger ring-danger/25' : 'bg-muted text-muted-foreground ring-border-strong',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className={cn('text-caption', danger ? 'text-danger' : 'text-muted-foreground')}>{message}</span>
    </div>
  );
}
