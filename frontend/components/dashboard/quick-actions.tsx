// Mirrors the sidebar's nav config (components/shell/nav-items.ts) so the
// dashboard's shortcuts and the sidebar never disagree about what's built
// and who can see it. Everything here is still `disabled` because Mine
// Explorer / Inspections / Alerts / Reports pages don't exist yet (later
// steps) — these are honest "coming soon" shortcuts, not dead links.

import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NAV_ITEMS } from '@/components/shell/nav-items';
import type { Role } from '@/types/enums';

const QUICK_ACTION_HREFS = ['/mines', '/inspections', '/alerts', '/reports', '/ai-risk'];

export function QuickActions({ role }: { role: Role }) {
  const items = NAV_ITEMS.filter(
    (item) => QUICK_ACTION_HREFS.includes(item.href) && (!item.roles || item.roles.includes(role)),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Command Modules</CardTitle>
        <CardDescription>Sections unlock as they ship</CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title={`${item.label} — coming soon`}
              className="hover-lift group relative flex cursor-not-allowed flex-col gap-4 overflow-hidden rounded-lg border border-border bg-surface-raised/40 p-4 hover:border-border-strong hover:bg-surface-raised"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-inset ring-border-strong transition-colors duration-150 group-hover:text-primary-soft">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden />
              </div>
              <span className="flex flex-col gap-1">
                <span className="text-subtitle text-foreground/80">{item.label}</span>
                <span className="text-[0.625rem] font-medium uppercase tracking-[0.06em] text-muted-foreground/60">
                  Soon
                </span>
              </span>
            </span>
          );
        })}
      </CardContent>
    </Card>
  );
}
