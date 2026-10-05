// Mirrors the real Command Center layout so the page doesn't reflow when
// data lands.

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-72" />
            <Skeleton className="h-3 w-96 max-w-full" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-8 w-full" />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="gap-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-60" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-3 w-24" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
