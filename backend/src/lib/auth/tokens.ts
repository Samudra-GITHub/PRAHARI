// JWT and refresh-token primitives.
//
// - Access tokens: short-lived (15m default), HS256-signed with
//   `JWT_ACCESS_SECRET`. Stateless — verified only by signature + exp.
// - Refresh tokens: long-lived (7d default), stored as a SHA-256 hash in
//   the `RefreshToken` table (rotating, revocable). Sent back to the client
//   as an httpOnly cookie on login/refresh.
//
// All secrets are read from env vars; if missing, the lib throws on first
// use rather than at module-load time, so the API surface still loads in
// static contexts (e.g. when the OpenAPI spec page is server-rendered).

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';

const enc = (s: string) => new TextEncoder().encode(s);

function accessSecret(): Uint8Array {
  const v = process.env.JWT_ACCESS_SECRET;
  if (!v) throw new Error('JWT_ACCESS_SECRET must be set in env');
  return enc(v);
}
function refreshSecret(): Uint8Array {
  const v = process.env.JWT_REFRESH_SECRET;
  if (!v) throw new Error('JWT_REFRESH_SECRET must be set in env');
  return enc(v);
}

export const ACCESS_TTL_DEFAULT = '15m';
export const REFRESH_TTL_DAYS_DEFAULT = 7;

function accessTtl(): string {
  return process.env.JWT_ACCESS_TTL || ACCESS_TTL_DEFAULT;
}
function refreshTtlSeconds(): number {
  const raw = process.env.JWT_REFRESH_TTL;
  if (!raw) return REFRESH_TTL_DAYS_DEFAULT * 24 * 60 * 60;
  const m = /^(\d+)([smhd])$/.exec(raw.trim());
  if (!m) return REFRESH_TTL_DAYS_DEFAULT * 24 * 60 * 60;
  const n = Number(m[1]);
  const f = m[2];
  return n * (f === 's' ? 1 : f === 'm' ? 60 : f === 'h' ? 3600 : 86400);
}

export type AccessPayload = JWTPayload & {
  sub: string;
  role: string;
  email: string;
};

export async function signAccessToken(input: { userId: string; role: string; email: string }): Promise<string> {
  return new SignJWT({ role: input.role, email: input.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(accessTtl())
    .setIssuer('mining-compliance')
    .setAudience('mining-compliance-api')
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(), {
      issuer: 'mining-compliance',
      audience: 'mining-compliance-api',
    });
    return payload as AccessPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

// Generate a raw refresh token, persist its SHA-256 hash to the DB, return
// the raw token to the caller (to be sent as an httpOnly cookie).
export async function issueRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const raw = randomBytes(48).toString('base64url');
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + refreshTtlSeconds() * 1000);
  await db.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
  return { token: raw, expiresAt };
}

// Verify a raw refresh token, mark the old row as revoked, and issue a new
// one. Returns null if the token is invalid, already revoked, or expired.
export async function rotateRefreshToken(raw: string): Promise<{ userId: string; token: string; expiresAt: Date } | null> {
  const tokenHash = sha256(raw);
  const record = await db.refreshToken.findUnique({ where: { tokenHash } });
  if (!record || record.revoked || record.expiresAt < new Date()) return null;
  await db.refreshToken.update({
    where: { id: record.id },
    data: { revoked: true },
  });
  const fresh = await issueRefreshToken(record.userId);
  return { userId: record.userId, token: fresh.token, expiresAt: fresh.expiresAt };
}

// Revoke a refresh token (used on logout). Idempotent.
export async function revokeRefreshToken(raw: string | undefined): Promise<void> {
  if (!raw) return;
  const tokenHash = sha256(raw);
  await db.refreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true },
  });
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
