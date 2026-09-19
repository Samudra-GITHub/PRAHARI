# syntax=docker/dockerfile:1
#
# PRAHARI backend — production image for the canonical Next.js + Prisma API.
#
# Adapted from the container setup in Jeevan's infra prototype, but it runs
# this backend rather than a separate FastAPI service:
#   deps    install with bun, the project's package manager (bun.lock)
#   build   generate the Prisma client and build the standalone Next.js server
#   runner  apply the schema, optionally seed, and serve (docker-entrypoint.sh)

ARG NODE_VERSION=24
ARG BUN_VERSION=1.3

FROM oven/bun:${BUN_VERSION} AS bun

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
# openssl lets the Prisma CLI detect and run the right schema-engine build on
# Debian slim.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json bun.lock ./
# Not --frozen-lockfile yet: pdf-lib was added on a machine without bun, so
# bun.lock doesn't list it. Run `bun install` once locally, commit the
# refreshed bun.lock, then switch this to `bun install --frozen-lockfile`.
RUN bun install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A placeholder PostgreSQL URL puts src/lib/db.ts on the lazy pg path, so the
# build never opens PGlite and never needs a reachable database.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:1/build
# `prisma generate` also fetches the Linux schema engine that the entrypoint's
# `prisma db push` needs, so containers don't download it on every start.
RUN ./node_modules/.bin/prisma generate
RUN ./node_modules/.bin/next build \
  && cp -r .next/static .next/standalone/.next/ \
  && cp -r public .next/standalone/

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The whole app ships (not only .next/standalone) because the entrypoint runs
# the Prisma CLI and the seed script against src/.
COPY --from=build --chown=node:node /app ./
# Guard against CRLF line endings if the script was checked out on Windows.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
