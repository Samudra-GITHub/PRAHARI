'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, NAV_SECTIONS } from './nav-items';
import { useLiveCounts } from '@/components/dashboard/dashboard-data-context';
import type { Role } from '@/types/enums';
import { cn } from '@/lib/utils';

// Real, live counts for the handful of nav destinations that map directly to
// a DashboardSummary field. Everything else gets no badge rather than a
// guessed one.
function badgeFor(href: string, counts: ReturnType<typeof useLiveCounts>): number | null {
  if (!counts) return null;
  if (href === '/alerts') return counts.alerts;
  if (href === '/inspections') return counts.overdue;
  if (href === '/violations') return counts.violations;
  return null;
}

export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: Role;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
  const counts = useLiveCounts();

  return (
    <nav className="flex flex-col gap-6 px-3 py-4" aria-label="Main">
      {NAV_SECTIONS.map((section) => {
        const items = visible.filter((item) => item.section === section);
        if (items.length === 0) return null;

        return (
          <div key={section} className="flex flex-col gap-1">
            {!collapsed && <span className="text-eyebrow px-3 pb-1 text-sidebar-foreground/40">{section}</span>}
            {collapsed && <span className="mx-3 mb-1 h-px bg-sidebar-border" aria-hidden />}

            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              const badge = badgeFor(item.href, counts);

              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    title={collapsed ? `${item.label} — coming soon` : undefined}
                    className={cn(
                      'group relative flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/35',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge !== null && badge > 0 ? (
                          <span className="tabular flex h-4 min-w-4 items-center justify-center rounded-full bg-danger/20 px-1 text-[0.625rem] font-semibold text-danger">
                            {badge}
                          </span>
                        ) : (
                          <span className="text-[0.625rem] font-medium uppercase tracking-[0.06em] text-sidebar-foreground/30">
                            Soon
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && badge !== null && badge > 0 && (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
                    )}
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-selected font-medium text-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  {/* Gold rail marks the active destination — animates in on change. */}
                  {active && (
                    <span
                      key={item.href}
                      className="animate-enter absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-gold"
                      aria-hidden
                    />
                  )}
                  <Icon
                    className={cn('h-4 w-4 shrink-0', active ? 'text-primary-soft' : 'text-current')}
                    aria-hidden
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
