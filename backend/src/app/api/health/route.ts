// GET /api/health
// Liveness + database connectivity check for container orchestration (the
// Docker Compose healthcheck gates the frontend on this). No auth, and it
// reveals nothing beyond up/down.

import { db } from '@/lib/db';
import { ok, bad } from '@/lib/http';

// A health check must never be served from a build-time or cached result.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return ok({ status: 'ok', database: 'up' });
  } catch {
    return bad('Database is unreachable', 'DATABASE_UNAVAILABLE', undefined, 503);
  }
}
