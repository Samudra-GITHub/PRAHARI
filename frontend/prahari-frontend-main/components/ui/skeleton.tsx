import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('relative overflow-hidden rounded-md bg-muted', 'animate-shimmer', className)} {...props} />;
}

export { Skeleton };
