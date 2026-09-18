import type { NextConfig } from "next";

// The backend (backend/) has no CORS headers configured — its own
// backend/Caddyfile reverse-proxies everything to the Next.js app on a
// single origin, so it was never built to be called cross-origin from a
// separate frontend host. Rather than requiring backend changes, this
// rewrite makes the browser's requests same-origin: it forwards this app's
// own `/api/*` requests to the backend server-side, so the browser only
// ever talks to one origin and the backend's httpOnly refresh cookie
// (path=/api/auth) gets set against that same origin correctly.
const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendOrigin}/api/:path*` }];
  },
};

export default nextConfig;
