// Helpers shared by list endpoints for parsing pagination + sort query
// strings.

import type { NextRequest } from 'next/server';
import { ListQuery, type ListQueryT } from '@/lib/validators';

export function parseListQuery(req: NextRequest): ListQueryT {
  const url = new URL(req.url);
  const raw: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) raw[k] = v;
  return ListQuery.parse(raw);
}

export type OrderByClause = Record<string, 'asc' | 'desc'>;

// Convert `?sort=createdAt:desc` → `{ createdAt: 'desc' }`. Defaults to
// `{ createdAt: 'desc' }`. Only whitelisted fields are allowed per
// caller — pass an allowlist.
export function parseSort(
  sort: string | undefined,
  allowedFields: string[],
): OrderByClause {
  if (!sort) return { createdAt: 'desc' };
  const [field, dir] = sort.split(':');
  if (!allowedFields.includes(field)) return { createdAt: 'desc' };
  const direction = dir === 'asc' ? 'asc' : 'desc';
  return { [field]: direction };
}

export const paginate = (page: number, pageSize: number) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});
