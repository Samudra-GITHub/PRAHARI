'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import type { User } from '@/types/models';

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Escape closes the mobile drawer — keyboard users shouldn't have to tab to
  // the backdrop to dismiss it.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar role={user.role} collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      </div>

      {/* Mobile off-canvas sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-background/80"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="animate-slide-in relative h-full w-64 shadow-2xl">
            <Sidebar role={user.role} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
