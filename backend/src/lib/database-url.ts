// Interprets DATABASE_URL so the runtime client (src/lib/db.ts) and the seed
// script (scripts/seed.ts) always agree on which database they're using.
//
//   postgres:// | postgresql://  → real PostgreSQL via @prisma/adapter-pg
//   pglite:<dir>                 → embedded PGlite, data in <dir>/dev
//   unset / anything else        → embedded PGlite, data in ./db/pglite/dev
//
// The PGlite layout (<parent>/dev) matches prisma-pglite's default
// `dbDirName`, which is what the original seed script relied on.

import { resolve } from 'node:path';

export function isPostgresUrl(url: string | undefined): url is string {
  return !!url && /^postgres(ql)?:\/\//i.test(url);
}

// The PGlite directory is runtime data, never server code, so these resolves
// opt out of Turbopack's output file tracing. Without the hint, the
// env-derived path makes the tracer copy the whole project (source, public/,
// the database itself) into the standalone build.
export function pgliteParentDir(url: string | undefined): string {
  if (url?.startsWith('pglite:')) {
    return resolve(/*turbopackIgnore: true*/ process.cwd(), url.slice('pglite:'.length));
  }
  return resolve(/*turbopackIgnore: true*/ process.cwd(), 'db/pglite');
}

export function pgliteDataDir(url: string | undefined): string {
  return resolve(pgliteParentDir(url), 'dev');
}
