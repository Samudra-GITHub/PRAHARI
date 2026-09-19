// PostgreSQL-backed Prisma client.
//
// The driver adapter is chosen from DATABASE_URL (see src/lib/database-url.ts):
//
//   - postgres:// or postgresql:// → @prisma/adapter-pg against a real
//     PostgreSQL server. This is what the Docker stack uses.
//   - otherwise → PGlite (PostgreSQL compiled to WASM, embedded in-process)
//     via `prisma-pglite`, exactly as before. Local development is unchanged.
//
// Both paths run the SAME schema and the SAME SQL — no SQLite fallback.
// No other code in the project needs to know which one is active.

import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGliteAdapterFactory } from 'prisma-pglite/dist/adapter/prisma-pglite-adapter/pglite.js';
import { existsSync, mkdirSync } from 'node:fs';
import { isPostgresUrl, pgliteDataDir } from '@/lib/database-url';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pglite: PGlite | undefined;
};

const DATABASE_URL = process.env.DATABASE_URL;
const PGLITE_DB_DIR = pgliteDataDir(DATABASE_URL);

async function createPrismaClient(): Promise<PrismaClient> {
  if (isPostgresUrl(DATABASE_URL)) {
    // The pg pool connects lazily on first query, so this is safe to create
    // at module load (including during `next build`).
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  }

  if (!globalForPrisma.pglite) {
    if (!existsSync(PGLITE_DB_DIR)) {
      mkdirSync(PGLITE_DB_DIR, { recursive: true });
    }
    const pglite = new PGlite(PGLITE_DB_DIR);
    await pglite.waitReady;
    process.exitCode = undefined;
    globalForPrisma.pglite = pglite;
  }
  // Prisma v7 expects a *factory* with a `connect()` method, not the
  // already-resolved adapter instance. `PrismaPGliteAdapterFactory` is
  // exactly that — Prisma calls `adapter.connect()` internally.
  const adapter = new PrismaPGliteAdapterFactory(globalForPrisma.pglite);
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.prisma ?? (await createPrismaClient());

if (process.env.NODE_ENV !== 'production' && !globalForPrisma.prisma) {
  globalForPrisma.prisma = db;
}

export default db;
