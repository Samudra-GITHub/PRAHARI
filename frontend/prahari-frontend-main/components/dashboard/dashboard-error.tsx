import { TriangleAlert, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-danger/25">
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger/12 text-danger ring-1 ring-inset ring-danger/25">
          <TriangleAlert className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-title text-foreground">Unable to load the Command Center</p>
          <p className="text-body max-w-md text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </Card>
  );
}
