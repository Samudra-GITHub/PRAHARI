// A plain, static proportion bar for displaying a real count against a
// real total (e.g. "2 of 5 approved"). Not an interactive control, so it
// doesn't need @radix-ui/react-progress — a styled div is enough.

import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  primary: 'bg-primary-soft',
  gold: 'bg-gold',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  muted: 'bg-muted-foreground',
} as const;

export function StatBar({
  value,
  max,
  tone = 'primary',
  className,
}: {
  value: number;
  max: number;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      role="img"
      aria-label={`${value} of ${max}`}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', TONE_CLASSES[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
