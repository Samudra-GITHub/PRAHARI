import { Loader2 } from 'lucide-react';

export function FullscreenLoader() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-primary-soft" aria-hidden />
      <span className="text-eyebrow text-muted-foreground/60">PRAHARI</span>
      <span className="sr-only">Loading</span>
    </div>
  );
}
