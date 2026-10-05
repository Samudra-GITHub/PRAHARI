'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, Loader2, Bell, ChevronDown, Radio, HeartPulse } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { useDashboardDataContext, useLiveCounts } from '@/components/dashboard/dashboard-data-context';
import { CommandSearch } from './command-search';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatRole, initials, formatClockTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { User } from '@/types/models';

function StatusChip({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Radio;
  label: string;
  tone: 'good' | 'warning' | 'critical' | 'neutral';
}) {
  const TONE: Record<typeof tone, string> = {
    good: 'bg-primary/12 text-primary-soft ring-primary/25',
    warning: 'bg-warning/12 text-warning ring-warning/25',
    critical: 'bg-danger/12 text-danger ring-danger/25',
    neutral: 'bg-muted text-muted-foreground ring-border-strong',
  };
  return (
    <span
      className={cn(
        'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.06em] ring-1 ring-inset md:inline-flex',
        TONE[tone],
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

export function Header({ user, onMenuClick }: { user: User; onMenuClick: () => void }) {
  const { logout } = useAuth();
  const router = useRouter();
  const dashboard = useDashboardDataContext();
  const counts = useLiveCounts();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionStart] = useState(() => new Date());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // POST /api/auth/logout — revokes the refresh token + clears the cookie.
      await logout();
    } finally {
      setLoggingOut(false);
      router.replace('/login');
    }
  }

  const aiActive =
    dashboard.status === 'ready' && (dashboard.data.recentInspections?.some((i) => i.riskScore !== null) ?? false);
  const healthTone = dashboard.status === 'ready' ? 'good' : dashboard.status === 'error' ? 'critical' : 'neutral';
  const healthLabel = dashboard.status === 'ready' ? 'Operational' : dashboard.status === 'error' ? 'Degraded' : 'Syncing';
  const alertCount = counts?.alerts ?? 0;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <CommandSearch role={user.role} />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <StatusChip icon={Radio} label={aiActive ? 'AI Active' : 'AI Standby'} tone={aiActive ? 'good' : 'neutral'} />
        <StatusChip icon={HeartPulse} label={healthLabel} tone={healthTone} />

        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
          aria-label={`Notifications${alertCount > 0 ? `, ${alertCount} open alerts` : ''}`}
          title={alertCount > 0 ? `${alertCount} open alert${alertCount === 1 ? '' : 's'}` : 'No open alerts'}
        >
          <Bell className="h-4 w-4" />
          {alertCount > 0 && (
            <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-semibold text-danger-foreground">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </button>

        <Separator orientation="vertical" className="hidden h-8 sm:block" />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors duration-150 hover:bg-accent"
          >
            <Avatar initials={initials(user.name)} size="sm" online />
            <div className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-caption font-medium text-foreground">{user.name}</span>
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-gold">
                {formatRole(user.role)}
              </span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-150', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="animate-enter absolute right-0 top-[calc(100%+0.5rem)] z-20 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
            >
              <div className="flex flex-col gap-1 border-b border-border px-4 py-3">
                <span className="text-body font-medium text-foreground">{user.name}</span>
                <span className="text-caption truncate text-muted-foreground">{user.email}</span>
                <span className="mt-1 inline-flex w-fit items-center rounded-full bg-gold/12 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-gold ring-1 ring-inset ring-gold/25">
                  {formatRole(user.role)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-4 py-2.5 text-caption text-muted-foreground">
                <span>Monitoring session live</span>
                <span className="text-readout text-foreground/80">since {formatClockTime(sessionStart)}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                role="menuitem"
                className="flex w-full items-center gap-2.5 border-t border-border px-4 py-2.5 text-left text-sm text-danger transition-colors duration-150 hover:bg-danger/8 disabled:opacity-50"
              >
                {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
