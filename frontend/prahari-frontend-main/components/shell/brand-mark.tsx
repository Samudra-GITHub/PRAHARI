// The PRAHARI lockup — shared by the sidebar and the login screen so the
// brand renders identically in both places.

import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandMark({
  size = 'sm',
  tagline,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  tagline?: string;
  className?: string;
}) {
  const large = size === 'lg';
  const medium = size === 'md';

  return (
    <div className={cn('flex items-center gap-3', large && 'flex-col gap-4 text-center', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground ring-1 ring-gold/30',
          large ? 'h-14 w-14 rounded-xl' : medium ? 'h-11 w-11 rounded-xl' : 'h-9 w-9',
        )}
      >
        <ShieldCheck className={large ? 'h-7 w-7' : medium ? 'h-5 w-5' : 'h-[1.125rem] w-[1.125rem]'} aria-hidden />
      </div>

      <div className={cn('flex min-w-0 flex-col', large && 'items-center gap-1')}>
        <span
          className={cn(
            'font-semibold tracking-[0.16em] text-foreground',
            large ? 'text-xl' : medium ? 'text-base' : 'text-sm leading-tight',
          )}
        >
          PRAHARI
        </span>
        {/* Gold hairline — the one decorative flourish in the identity. */}
        {large && <span className="h-px w-12 bg-gold/60" aria-hidden />}
        {tagline && <span className="text-caption text-muted-foreground">{tagline}</span>}
        {!large && !medium && !tagline && (
          <span className="text-[0.625rem] uppercase leading-tight tracking-[0.1em] text-muted-foreground">
            Compliance
          </span>
        )}
      </div>
    </div>
  );
}
