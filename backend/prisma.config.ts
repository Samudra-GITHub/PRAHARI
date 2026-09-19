import 'dotenv/config';
import { defineConfig } from '@prisma/config';

// `prisma-pglite` reads `DATABASE_URL` to decide where to store the PGlite
// data directory on disk. We use `file:./db/pglite` which the adapter
// interprets as the directory path for the persistent PGlite instance.
//
// In production, set `DATABASE_URL=postgresql://user:password@host:5432/db`
// and the same `schema.prisma` will work against a real PostgreSQL server
// without any schema changes.
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Only a real PostgreSQL URL is handed to the Prisma CLI (the Docker
  // entrypoint runs `prisma db push`). The local PGlite flow pushes its schema
  // through prisma-pglite and must not see a `pglite:` URL the CLI can't use.
  ...(databaseUrl && /^postgres(ql)?:\/\//i.test(databaseUrl) ? { datasource: { url: databaseUrl } } : {}),
});
