'use client';

// A quick-jump search restricted to nav destinations that actually exist and
// are visible to this role (components/shell/nav-items.ts) — it filters and
// navigates client-side only, never calls an endpoint, so it can't imply a
// full-text search over mines/inspections/alerts that the backend doesn't
// expose.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { NAV_ITEMS } from './nav-items';
import type { Role } from '@/types/enums';
import { cn } from '@/lib/utils';

export function CommandSearch({ role }: { role: Role }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const destinations = NAV_ITEMS.filter((item) => !item.disabled && (!item.roles || item.roles.includes(role)));
  const matches =
    query.trim().length === 0
      ? destinations
      : destinations.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function go(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Jump to…"
        aria-label="Jump to a section"
        className="h-8 w-full rounded-md border border-border-strong bg-surface-raised/50 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors duration-150 hover:border-border-strong hover:bg-surface-raised"
      />

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-20 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {matches.length === 0 ? (
            <p className="text-caption px-3 py-2.5 text-muted-foreground">No matching section.</p>
          ) : (
            <ul className="flex flex-col py-1">
              {matches.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <button
                      type="button"
                      onClick={() => go(item.href)}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors duration-150 hover:bg-accent',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
