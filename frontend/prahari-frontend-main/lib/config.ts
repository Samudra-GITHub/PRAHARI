// Shared runtime config. Kept in its own module (rather than inside lib/api.ts)
// so lib/auth.ts can read it without creating a circular import between
// lib/api.ts and lib/auth.ts (api.ts calls into auth.ts for the token/refresh
// logic, and auth.ts calls the refresh endpoint directly).

// Empty string = same-origin, relative requests (e.g. fetch('/api/auth/login')
// resolves against wherever this app itself is served). That's the default
// because next.config.ts's rewrite proxies this app's own /api/* to the
// backend server-side — the backend has no CORS headers, so a direct
// cross-origin fetch from the browser would otherwise be blocked. Only set
// NEXT_PUBLIC_API_BASE_URL if you're deliberately bypassing that proxy (e.g.
// calling a backend that already has CORS configured for this origin).
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
