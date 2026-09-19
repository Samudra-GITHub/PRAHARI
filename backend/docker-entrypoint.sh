#!/bin/sh
# PRAHARI backend container entrypoint.
#
# Adapted from the entrypoint in Jeevan's infra prototype (wait for Postgres ->
# create tables -> seed -> serve). Waiting is handled by the Compose
# healthcheck on the database, and Prisma owns the schema.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is not set" >&2
  exit 1
fi

echo "[entrypoint] applying Prisma schema to PostgreSQL..."
# No --accept-data-loss: a destructive schema change should stop the container
# rather than silently drop data from a persistent volume.
./node_modules/.bin/prisma db push

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "[entrypoint] seeding demo data (idempotent)..."
  bun run scripts/seed.ts
fi

echo "[entrypoint] starting API on ${HOSTNAME}:${PORT}"
exec node .next/standalone/server.js
