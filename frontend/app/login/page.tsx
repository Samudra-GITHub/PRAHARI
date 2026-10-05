'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { LoginForm } from '@/components/auth/login-form';
import { BrandMark } from '@/components/shell/brand-mark';
import { FullscreenLoader } from '@/components/shell/fullscreen-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  // Still attempting session restore, or already signed in and about to be
  // redirected — either way, don't flash the form.
  if (status === 'loading' || status === 'authenticated') return <FullscreenLoader />;

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Tactical grid + a soft radial lift behind the card — the same
          mission-control motif as the Command Center hero, kept extremely
          quiet so it reads as texture rather than decoration. */}
      <div aria-hidden className="bg-tactical-grid pointer-events-none absolute inset-0 opacity-[0.35]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% 0%, oklch(0.46 0.088 155 / 0.14), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(40rem 24rem at 100% 100%, oklch(0.765 0.095 82 / 0.06), transparent 70%)',
        }}
      />

      <div className="animate-enter relative flex w-full max-w-sm flex-col items-center gap-8">
        <BrandMark size="lg" tagline="Mining Compliance Management System" />

        <Card className="w-full border-border-strong/60 shadow-xl shadow-black/20">
          <CardHeader className="gap-1.5">
            <div className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-primary-soft ring-1 ring-inset ring-primary/25">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-soft" aria-hidden />
              Secure access
            </div>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your issued departmental credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-caption text-center text-muted-foreground/60">
          Authorised personnel only. All access is audited.
        </p>
      </div>
    </div>
  );
}
