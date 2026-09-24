# Contributing to PRAHARI

Thanks for considering a contribution to this Smart India Hackathon project.

## Getting set up

```bash
git clone https://github.com/Samudra-GITHub/PRAHARI.git
cd PRAHARI
cp .env.example .env   # fill in every value — see README
docker compose up --build
```

Compose refuses to start while any required secret is empty.

## Before opening a PR

```bash
cd backend
bun run lint
bun run build
```

If your change touches the database schema, include the Prisma migration (`bun run db:migrate`).

## Scope

- API changes belong in `backend/src/app/api/`, organized by domain (mines, inspections, violations, alerts, ai, copilot, reports, audit-logs).
- Schema changes go through Prisma — never edit the database directly.
- Frontend changes belong under `frontend/` or `abheeshta-frontend/` depending on which surface you're touching — check with the team before assuming.

## Reporting issues

Use the issue templates under `.github/ISSUE_TEMPLATE/`.
