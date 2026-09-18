import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Status/severity labels. Tinted fill + inset hairline so they stay legible
// on dark surfaces without shouting. Uppercase tracking gives the
// institutional, plate-like feel the rest of the identity uses.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold uppercase leading-4 tracking-[0.06em] whitespace-nowrap ring-1 ring-inset',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground ring-border-strong',
        primary: 'bg-primary/15 text-primary-soft ring-primary/25',
        gold: 'bg-gold/15 text-gold ring-gold/25',
        success: 'bg-success/15 text-success ring-success/25',
        warning: 'bg-warning/15 text-warning ring-warning/25',
        danger: 'bg-danger/15 text-danger ring-danger/30',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
