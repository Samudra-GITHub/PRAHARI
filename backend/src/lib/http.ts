// Standard API response helpers.
//
// Every route handler in this codebase returns responses shaped by these
// helpers so the frontend team can rely on a single, predictable envelope.
//
//   Success: { ok: true,  data: T }            — HTTP 2xx
//   Failure: { ok: false, error: { code, message, details? } } — HTTP 4xx/5xx
//
// The envelope is documented in the OpenAPI spec served at /api/docs.

import { NextResponse } from 'next/server';

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};

export type ApiResult<T> = ApiOk<T> | ApiErr;

export const ok = <T>(data: T, status: number = 200) =>
  NextResponse.json<ApiOk<T>>({ ok: true, data }, { status });

export const noContent = () => new NextResponse(null, { status: 204 });

export const bad = (
  message: string,
  code: string = 'BAD_REQUEST',
  details?: unknown,
  status: number = 400,
) => NextResponse.json<ApiErr>(
  { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } },
  { status },
);

export const unauthenticated = (message: string = 'Authentication required') =>
  bad(message, 'UNAUTHENTICATED', undefined, 401);

export const forbidden = (message: string = 'You do not have access to this resource') =>
  bad(message, 'FORBIDDEN', undefined, 403);

export const notFound = (message: string = 'Resource not found') =>
  bad(message, 'NOT_FOUND', undefined, 404);

export const conflict = (message: string, details?: unknown) =>
  bad(message, 'CONFLICT', details, 409);

export const serverError = (message: string = 'Internal server error') =>
  bad(message, 'INTERNAL_ERROR', undefined, 500);

export const unprocessable = (message: string, details?: unknown) =>
  bad(message, 'UNPROCESSABLE_ENTITY', details, 422);
