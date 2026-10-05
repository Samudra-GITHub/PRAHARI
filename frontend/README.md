# PRAHARI frontend

Next.js 16 (App Router) dashboard and copilot UI for PRAHARI. See the [root README](../README.md) for the project overview and the full-stack setup.

- `app/login` and `app/(app)/` (dashboard, `copilot/`)
- `services/` holds one typed API client per backend resource
- `next.config.ts` rewrites `/api/*` to the backend (`BACKEND_ORIGIN`, default `http://localhost:3000`), so the browser stays same-origin

```bash
npm install
npm run dev -- -p 3001    # the backend uses port 3000 in local development
npm run build
npm run lint
```
