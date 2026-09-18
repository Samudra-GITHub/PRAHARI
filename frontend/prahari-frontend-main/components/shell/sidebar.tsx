import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { BrandMark } from './brand-mark';
import type { Role } from '@/types/enums';
import { cn } from '@/lib/utils';

export function Sidebar({
  role,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: {
  role: Role;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'px-5')}>
        {collapsed ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground ring-1 ring-gold/30">
            <span className="text-xs font-bold tracking-tight">P</span>
          </div>
        ) : (
          <BrandMark />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav role={role} collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <div className="shrink-0 border-t border-sidebar-border px-2 py-3">
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-caption text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed ? 'w-full justify-center' : 'w-full',
            )}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" aria-hidden /> : <ChevronsLeft className="h-4 w-4" aria-hidden />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
        {!collapsed && (
          <p className="mt-2 px-3 text-[0.625rem] leading-4 tracking-[0.06em] text-sidebar-foreground/35 uppercase">
            Mining Compliance
            <br />
            Management System
          </p>
        )}
      </div>
    </div>
  );
}
