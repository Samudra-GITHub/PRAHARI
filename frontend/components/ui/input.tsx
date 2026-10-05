import * as React from 'react';

import { cn } from '@/lib/utils';

// `aria-invalid` drives the error styling, so validation state is announced
// to assistive tech and shown visually from the same source of truth.
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-border-strong bg-surface-raised/50 px-3 text-sm text-foreground',
        'transition-[border-color,background-color] duration-150',
        'placeholder:text-muted-foreground/70',
        'hover:border-border-strong hover:bg-surface-raised',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-danger/70 aria-[invalid=true]:bg-danger/5',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
