// Audit logging with tamper-evident chaining.
//
// Every audit log row stores a `prevHash` (hash of the previous log row)
// and a `resultHash` (hash of its own canonical payload). Anyone with read
// access to the audit logs can re-walk the chain to verify nothing was
// retroactively edited or deleted.
//
// The hash chain is best-effort deterministic and is intended as a
// tamper-evident log, NOT a cryptographic proof. A production deployment
// would extend this with periodic Merkle-root snapshots written to a
// write-once store (S3 Object Lock, KMS-backed ledger, etc.).

import { db } from '@/lib/db';
import { sha256 } from '@/lib/auth/tokens';
import type { Prisma } from '@/generated/prisma/client';

export type AuditInput = {
  actorId?: string | null;
  action: string;            // e.g. "USER_LOGIN", "INSPECTION_CREATE"
  resource: string;          // e.g. "Mine", "Inspection"
  resourceId?: string | null;
  payload?: Record<string, unknown> | null;
};

// Deterministic JSON serialization (sorted keys) so the hash is stable
// regardless of insertion order. Used for both WRITE (computing the
// resultHash that gets stored) and VERIFY (recomputing the hash to
// compare). This is critical because PostgreSQL JSON columns normalise
// key order — without this canonical form, the verify step would
// compute a different hash from the same payload.
function canonical(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  const entries = Object.entries(obj as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
}

function hashPayload(action: string, resource: string, resourceId: string | null, payload: unknown, prevHash: string | null): string {
  // Canonicalise the payload so the hash is identical whether the
  // payload is in JS object form (insert time) or freshly read back
  // from a Postgres JSON column (verify time).
  const payloadJson = canonical(payload);
  return sha256(canonical({ action, resource, resourceId: resourceId ?? null, payload: payloadJson, prevHash: prevHash ?? null }));
}

export async function audit(input: AuditInput): Promise<void> {
  // Find the previous audit log entry (newest by createdAt) — this is the
  // head of the chain. Under concurrent writes there may be a race; we
  // accept a tiny probability of duplicate prevHash for simplicity.
  const prev = await db.auditLog.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { resultHash: true },
  });
  const prevHash = prev?.resultHash ?? null;
  const resultHash = hashPayload(input.action, input.resource, input.resourceId ?? null, input.payload ?? null, prevHash);
  await db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      payload: (input.payload ?? null) as Prisma.InputJsonValue,
      prevHash,
      resultHash,
    },
  });
}

// Re-walk the audit log chain and return a verification report.
export type ChainReport = {
  totalRows: number;
  broken: number;
  firstBrokenAt: number | null; // 0-indexed row position
  firstBrokenId: string | null;
};

export async function verifyChain(): Promise<ChainReport> {
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, action: true, resource: true, resourceId: true, payload: true, prevHash: true, resultHash: true },
  });
  let expectedPrev: string | null = null;
  let broken = 0;
  let firstBrokenAt: number | null = null;
  let firstBrokenId: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const expected = hashPayload(row.action, row.resource, row.resourceId ?? null, row.payload, expectedPrev);
    if (row.prevHash !== expectedPrev || row.resultHash !== expected) {
      broken++;
      if (firstBrokenAt === null) {
        firstBrokenAt = i;
        firstBrokenId = row.id;
      }
    }
    expectedPrev = row.resultHash;
  }
  return { totalRows: rows.length, broken, firstBrokenAt, firstBrokenId };
}
