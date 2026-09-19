// Role-Based Access Control (RBAC) primitives.
//
// Roles:
//   - FIELD_INSPECTOR : can create inspections, view assigned mines.
//   - MINE_OFFICIAL   : manages their own mine's inspections, reports,
//                       violations, alerts.
//   - CORPORATE_ADMIN : full read/write across all mines.
//   - REGULATOR       : read-only across all mines + audit log access.
//
// `requireRole` is a Next.js route-handler guard that:
//   1. Reads the `Authorization: Bearer <access_token>` header.
//   2. Verifies the JWT signature and expiration.
//   3. Loads the user record from the database.
//   4. Verifies the user is active.
//   5. Verifies the user's role is in the allowed set.
//   6. Attaches the user to the request as a typed property.
//   7. Returns a `401`/`403` envelope on failure.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/tokens';
import { unauthenticated, forbidden } from '@/lib/http';
import type { Role, User } from '@/generated/prisma/client';

// `MyRequest` is the NextRequest with the authenticated user attached. It
// lets downstream handlers access `req.user` without re-reading the JWT.
export type MyRequest = NextRequest & { user: User };

export type RequireRoleOptions = {
  // Optional: a per-resource check that has access to route params. If it
  // returns false the request is rejected with 403.
  resourceCheck?: (req: MyRequest, params: Record<string, string>) => boolean | Promise<boolean>;
};

export const ALL_ROLES: Role[] = [
  'FIELD_INSPECTOR',
  'MINE_OFFICIAL',
  'CORPORATE_ADMIN',
  'REGULATOR',
];

// Permission matrix. `true` means the role is allowed to perform the action
// by default. Resource-level checks (e.g. "does this mine belong to this
// official?") are applied separately via `mineScope`.
export const PERMISSIONS = {
  // Mines
  MINE_READ:        { FIELD_INSPECTOR: true,  MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: true  },
  MINE_WRITE:       { FIELD_INSPECTOR: false, MINE_OFFICIAL: false, CORPORATE_ADMIN: true,  REGULATOR: false },
  // Inspections
  INSPECTION_READ:  { FIELD_INSPECTOR: true,  MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: true  },
  INSPECTION_WRITE: { FIELD_INSPECTOR: true,  MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: false },
  // Reports
  REPORT_READ:      { FIELD_INSPECTOR: false, MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: true  },
  REPORT_WRITE:    { FIELD_INSPECTOR: false, MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: false },
  REPORT_APPROVE:  { FIELD_INSPECTOR: false, MINE_OFFICIAL: false, CORPORATE_ADMIN: true,  REGULATOR: false },
  // Violations
  VIOLATION_READ:  { FIELD_INSPECTOR: true,  MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: true  },
  VIOLATION_WRITE: { FIELD_INSPECTOR: true,  MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: false },
  // Alerts
  ALERT_READ:      { FIELD_INSPECTOR: true,  MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: true  },
  ALERT_WRITE:    { FIELD_INSPECTOR: false, MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: false },
  // Audit logs
  AUDIT_READ:      { FIELD_INSPECTOR: false, MINE_OFFICIAL: false, CORPORATE_ADMIN: true,  REGULATOR: true  },
  // AI risk
  AI_RISK:         { FIELD_INSPECTOR: true,  MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: false },
  // Dashboard
  DASHBOARD:       { FIELD_INSPECTOR: true,  MINE_OFFICIAL: true,  CORPORATE_ADMIN: true,  REGULATOR: true  },
  // Workflow run (cron) — no human role; only the CRON_SECRET triggers it.
  WORKFLOW_RUN:    { FIELD_INSPECTOR: false, MINE_OFFICIAL: false, CORPORATE_ADMIN: false, REGULATOR: false },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function can(role: Role, key: PermissionKey): boolean {
  return PERMISSIONS[key][role] ?? false;
}

// Scope a Prisma `where` clause so the caller only sees resources they are
// permitted to see based on their role:
//   - FIELD_INSPECTOR  → only inspections they performed (handled per-route)
//   - MINE_OFFICIAL    → only resources where `mineId == user.mineId`
//   - CORPORATE_ADMIN  → no scope filter
//   - REGULATOR        → no scope filter (read-only)
export function mineScopeFilter(user: User): { mineId?: string } {
  if (user.role === 'MINE_OFFICIAL' && user.mineId) {
    return { mineId: user.mineId };
  }
  return {};
}

// Filter for the Mine model itself (which is keyed by `id`, not `mineId`).
export function mineSelfFilter(user: User): { id?: string } {
  if (user.role === 'MINE_OFFICIAL' && user.mineId) {
    return { id: user.mineId };
  }
  return {};
}

export function isMineScoped(role: Role): boolean {
  return role === 'MINE_OFFICIAL';
}

// ---------------------------------------------------------------------------
// Middleware: `requireRole`
// ---------------------------------------------------------------------------

export async function requireRole(
  req: NextRequest,
  allowed: Role[],
  params: Record<string, string> = {},
  options?: RequireRoleOptions,
): Promise<{ ok: true; req: MyRequest } | { ok: false; response: ReturnType<typeof unauthenticated> | ReturnType<typeof forbidden> }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, response: unauthenticated('Missing or malformed Authorization header. Expected: Bearer <token>') };
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = await verifyAccessToken(token);
  if (!payload) {
    return { ok: false, response: unauthenticated('Invalid or expired access token') };
  }
  const userId = payload.sub;
  if (!userId) {
    return { ok: false, response: unauthenticated('Malformed token: missing subject') };
  }
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) {
    return { ok: false, response: unauthenticated('User not found or deactivated') };
  }
  if (!allowed.includes(user.role)) {
    return { ok: false, response: forbidden(`Role ${user.role} is not permitted to call this endpoint`) };
  }
  const myReq = Object.assign(req, { user }) as MyRequest;
  if (options?.resourceCheck) {
    const allowed2 = await options.resourceCheck(myReq, params);
    if (!allowed2) {
      return { ok: false, response: forbidden('Access denied to this specific resource') };
    }
  }
  return { ok: true, req: myReq };
}
