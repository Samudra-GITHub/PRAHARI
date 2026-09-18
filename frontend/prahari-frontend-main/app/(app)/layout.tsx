'use client';

// Route-group layout for every authenticated page. Guards access: renders a
// loading state while session restoration is in progress, redirects to
// /login if it's not authenticated, and otherwise wraps children in the
// app shell (sidebar + header).

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { AppShell } from '@/components/shell/app-shell';
import { FullscreenLoader } from '@/components/shell/fullscreen-loader';
import { DashboardDataProvider } from '@/components/dashboard/dashboard-data-context';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') return <FullscreenLoader />;
  // Unauthenticated: the redirect above is in flight — render nothing.
  if (status !== 'authenticated' || !user) return null;

  // One shared dashboard fetch for the whole authenticated shell — the
  // header's live status/alert chips, the sidebar's nav badges, and the
  // Command Center page all read the same in-flight/loaded data instead of
  // each re-fetching independently.
  return (
    <DashboardDataProvider>
      <AppShell user={user}>{children}</AppShell>
    </DashboardDataProvider>
  );
}
