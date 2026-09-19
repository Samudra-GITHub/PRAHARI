// GET /api/docs
// Returns the OpenAPI 3.1 spec as JSON. Consumed by Swagger UI, Redoc,
// Postman, or any tool that reads OpenAPI documents.

import { NextResponse } from 'next/server';
import { getOpenApiSpec } from '@/lib/openapi/spec';

export async function GET() {
  const spec = getOpenApiSpec();
  return NextResponse.json(spec, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
