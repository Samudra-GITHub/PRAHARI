// A plain initials avatar. The backend's User model has no profile-image
// field, so there is no image to load/fallback from — no need for
// @radix-ui/react-avatar's image-loading state machine here.

import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'h-8 w-8 text-[0.6875rem]',
  default: 'h-9 w-9 text-xs',
} as const;

function Avatar({
  initials,
  size = 'default',
  online = false,
  className,
}: {
  initials: string;
  size?: keyof typeof SIZES;
  // A live-session indicator, not a presence/status feature — true whenever
  // this avatar represents the currently authenticated user in the shell.
  online?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-primary font-semibold tracking-wide text-primary-foreground ring-1 ring-primary-soft/25',
          SIZES[size],
        )}
        aria-hidden
      >
        {initials}
      </div>
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-background"
          aria-hidden
        />
      )}
    </div>
  );
}

export { Avatar };
