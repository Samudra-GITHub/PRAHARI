# syntax=docker/dockerfile:1
#
# PRAHARI frontend — production image.
#
# The browser only ever talks to this server: next.config.ts rewrites /api/*
# to the backend, so no CORS is needed and the httpOnly refresh cookie stays
# same-origin.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The /api rewrite destination is compiled into .next/routes-manifest.json at
# build time — setting BACKEND_ORIGIN only at runtime has no effect — so the
# backend's address must be supplied as a build argument.
ARG BACKEND_ORIGIN=http://backend:3000
ENV BACKEND_ORIGIN=${BACKEND_ORIGIN}
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
