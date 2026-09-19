// Landing page for the Mining Compliance Management API.
//
// This is the only user-visible page in the app. It explains:
//   - what the project is
//   - the role hierarchy
//   - sample login credentials (after seeding)
//   - links to Swagger UI and the raw OpenAPI JSON
//   - the full endpoint catalogue grouped by domain
//
// NOTE: the page intentionally does NOT call into Prisma on render to keep
// the render path cheap and to avoid the dev server running heavy DB
// work on every hot-reload. Use `bun run seed` to populate demo data.

import { getOpenApiSpec } from '@/lib/openapi/spec';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mining Compliance Management API',
  description: 'Backend API for mining compliance: inspections, alerts, reports, violations, audit logs, and AI risk scoring.',
};

const DEMO_USERS = [
  { role: 'FIELD_INSPECTOR', email: 'inspector@demo.local', password: 'demo12345' },
  { role: 'MINE_OFFICIAL', email: 'official@demo.local', password: 'demo12345' },
  { role: 'CORPORATE_ADMIN', email: 'corporate@demo.local', password: 'demo12345' },
  { role: 'REGULATOR', email: 'regulator@demo.local', password: 'demo12345' },
];

export default function Home() {
  const spec = getOpenApiSpec();

  // Group paths by tag for display.
  type Path = { method: string; path: string; summary: string; tags: string[] };
  const allPaths: Path[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const o = op as { summary?: string; tags?: string[] };
      allPaths.push({ method, path, summary: o.summary ?? '', tags: o.tags ?? [] });
    }
  }
  const byTag: Record<string, Path[]> = {};
  for (const p of allPaths) {
    const tag = p.tags[0] ?? 'Other';
    (byTag[tag] ??= []).push(p);
  }

  return (
    <main className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Backend API · v1.0.0</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Mining Compliance Management API</h1>
          <p className="mt-3 text-slate-300 max-w-2xl">
            JWT-authenticated REST API for inspections, alerts, reports, violations, audit logs (with chain
            verification), AI risk scoring, and 5 automated escalation workflows. Backed by PostgreSQL via
            Prisma v7. Every endpoint is documented in OpenAPI 3.1.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/api-docs" className="inline-flex items-center px-4 py-2 bg-white text-slate-900 rounded-md font-medium hover:bg-slate-100 transition">
              Open Swagger UI →
            </a>
            <a href="/api/docs" className="inline-flex items-center px-4 py-2 border border-slate-700 text-slate-100 rounded-md font-medium hover:bg-slate-800 transition">
              OpenAPI JSON
            </a>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto w-full px-6 py-10 grid gap-8 md:grid-cols-2">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Demo accounts</h2>
          <p className="text-sm text-slate-500 mb-4">
            Use any of these credentials with <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">POST /api/auth/login</code>.
            After login, copy the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">accessToken</code> into
            the Swagger UI "Authorize" dialog as <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">Bearer &lt;token&gt;</code>.
            Run <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">bun run seed</code> to populate these users.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2">Password</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_USERS.map(u => (
                  <tr key={u.email} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-mono text-xs">{u.role}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{u.email}</td>
                    <td className="py-2 font-mono text-xs">{u.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Workflow triggers</h2>
          <p className="text-sm text-slate-500 mb-4">
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">POST /api/workflow/run</code> runs all
            five escalation triggers and creates an <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">Alert</code> for
            each match. Protected by the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">x-cron-secret</code> header
            (set to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">CRON_SECRET</code> env var).
          </p>
          <ul className="text-sm space-y-2 list-disc list-inside text-slate-700">
            <li><span className="font-semibold">Inspection overdue</span> — any inspection past <code className="text-xs">scheduledDate</code> still SCHEDULED/IN_PROGRESS.</li>
            <li><span className="font-semibold">Repeated violations</span> — mine with 3+ violations in 90 days.</li>
            <li><span className="font-semibold">High AI risk score</span> — inspection with <code className="text-xs">riskScore</code> ≥ 0.8.</li>
            <li><span className="font-semibold">Missing mandatory report</span> — active mine with no submitted report in last 30 days.</li>
            <li><span className="font-semibold">Environmental threshold crossed</span> — reading exceeds its parameter threshold.</li>
          </ul>
        </div>
      </section>

      <section className="max-w-6xl mx-auto w-full px-6 pb-16">
        <h2 className="text-lg font-semibold mb-4">Endpoint catalogue</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(byTag).sort(([a], [b]) => a.localeCompare(b)).map(([tag, items]) => (
            <div key={tag} className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold mb-3 text-slate-700">{tag}</h3>
              <ul className="space-y-1.5">
                {items.map(p => (
                  <li key={`${p.method}:${p.path}`} className="text-xs">
                    <span className={`inline-block w-12 font-mono font-semibold ${methodColor(p.method)}`}>{p.method.toUpperCase()}</span>
                    <span className="ml-2 font-mono">{p.path}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto bg-slate-900 text-slate-400 text-xs py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-2">
          <p>PostgreSQL · Prisma v7 · Next.js 16 · JWT (jose) · bcryptjs · Zod</p>
          <p>Built for the Mining Compliance Management System — backend deliverable.</p>
        </div>
      </footer>
    </main>
  );
}

function methodColor(method: string): string {
  switch (method) {
    case 'get': return 'text-emerald-600';
    case 'post': return 'text-blue-600';
    case 'patch': return 'text-amber-600';
    case 'delete': return 'text-rose-600';
    default: return 'text-slate-600';
  }
}
