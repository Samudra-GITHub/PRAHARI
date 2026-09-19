// OpenAPI 3.1 specification generator.
//
// This file is the single source of truth for the public API contract:
//   - `getOpenApiSpec()` returns the OpenAPI 3.1 document as a plain object.
//   - The `/api/docs` route serves it as JSON for any tool that consumes
//     OpenAPI (Postman, Redocly, Stoplight, swagger-ui-dist, etc.).
//   - The `/api-docs` page renders it via Swagger UI.
//
// Every endpoint added to the codebase MUST be added here so the frontend
// team always has a single contract to consume. Schemas are referenced via
// `#/components/schemas/...` so the same response/request shape is reused
// across endpoints.

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

export type EndpointSpec = {
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  auth?: boolean;
  roles?: ('FIELD_INSPECTOR' | 'MINE_OFFICIAL' | 'CORPORATE_ADMIN' | 'REGULATOR')[];
  params?: { name: string; in: 'path' | 'query' | 'header'; required: boolean; schema: Record<string, unknown>; description?: string }[];
  body?: { required: boolean; schemaRef: string; description?: string };
  responses: { status: number; description: string; schemaRef?: string }[];
};

// ---------------------------------------------------------------------------
// Shared schemas (re-used across endpoints)
// ---------------------------------------------------------------------------

const SCHEMAS: Record<string, Record<string, unknown>> = {
  ApiOk: {
    type: 'object',
    required: ['ok', 'data'],
    properties: {
      ok: { type: 'boolean', example: true },
      data: {},
    },
    description: 'Standard success envelope',
  },
  ApiErr: {
    type: 'object',
    required: ['ok', 'error'],
    properties: {
      ok: { type: 'boolean', example: false },
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', example: 'BAD_REQUEST' },
          message: { type: 'string', example: 'A human-readable error message' },
          details: {},
        },
      },
    },
    description: 'Standard error envelope',
  },
  User: {
    type: 'object',
    required: ['id', 'email', 'name', 'role', 'active', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', example: 'cmtz...' },
      email: { type: 'string', format: 'email' },
      name: { type: 'string' },
      role: { $ref: '#/components/schemas/Role' },
      mineId: { type: 'string', nullable: true },
      active: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  Role: { type: 'string', enum: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'] },
  AuthLoginResponse: {
    type: 'object',
    required: ['accessToken', 'user'],
    properties: {
      accessToken: { type: 'string' },
      user: { $ref: '#/components/schemas/User' },
    },
  },
  Mine: {
    type: 'object',
    required: ['id', 'name', 'code', 'location', 'status', 'complianceScore', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      code: { type: 'string' },
      location: { type: 'string' },
      region: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
      complianceScore: { type: 'number', minimum: 0, maximum: 100 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  Inspection: {
    type: 'object',
    required: ['id', 'mineId', 'inspectorId', 'type', 'status', 'scheduledDate', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' },
      mineId: { type: 'string' },
      inspectorId: { type: 'string' },
      type: { type: 'string', enum: ['SAFETY', 'ENVIRONMENTAL', 'EQUIPMENT', 'COMPLIANCE', 'ROUTINE'] },
      status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE'] },
      scheduledDate: { type: 'string', format: 'date-time' },
      completedDate: { type: 'string', format: 'date-time', nullable: true },
      summary: { type: 'string', nullable: true },
      findings: { type: 'object', nullable: true },
      riskScore: { type: 'number', minimum: 0, maximum: 1, nullable: true },
      riskReasons: { type: 'array', items: { type: 'string' } },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  Alert: {
    type: 'object',
    required: ['id', 'type', 'severity', 'status', 'title', 'message', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' },
      type: { type: 'string', enum: ['INSPECTION_OVERDUE', 'REPEATED_VIOLATIONS', 'HIGH_AI_RISK', 'MISSING_REPORT', 'ENVIRONMENTAL_THRESHOLD', 'MANUAL'] },
      severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      status: { type: 'string', enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] },
      title: { type: 'string' },
      message: { type: 'string' },
      mineId: { type: 'string', nullable: true },
      inspectionId: { type: 'string', nullable: true },
      violationId: { type: 'string', nullable: true },
      reportId: { type: 'string', nullable: true },
      triggerData: { type: 'object', nullable: true },
      assignedToId: { type: 'string', nullable: true },
      acknowledgedById: { type: 'string', nullable: true },
      acknowledgedAt: { type: 'string', format: 'date-time', nullable: true },
      resolvedAt: { type: 'string', format: 'date-time', nullable: true },
      dueDate: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  Report: {
    type: 'object',
    required: ['id', 'mineId', 'authorId', 'type', 'status', 'title', 'body', 'periodStart', 'periodEnd', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' },
      mineId: { type: 'string' },
      authorId: { type: 'string' },
      type: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'INCIDENT', 'COMPLIANCE'] },
      status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] },
      title: { type: 'string' },
      body: { type: 'string' },
      periodStart: { type: 'string', format: 'date-time' },
      periodEnd: { type: 'string', format: 'date-time' },
      submittedAt: { type: 'string', format: 'date-time', nullable: true },
      approvedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  Violation: {
    type: 'object',
    required: ['id', 'mineId', 'issuedById', 'severity', 'status', 'code', 'description', 'penaltyAmount', 'escalationCount', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' },
      mineId: { type: 'string' },
      inspectionId: { type: 'string', nullable: true },
      issuedById: { type: 'string' },
      severity: { type: 'string', enum: ['MINOR', 'MAJOR', 'CRITICAL'] },
      status: { type: 'string', enum: ['OPEN', 'NOTIFIED', 'RECTIFIED', 'ESCALATED', 'CLOSED'] },
      code: { type: 'string' },
      description: { type: 'string' },
      penaltyAmount: { type: 'number' },
      rectifiedAt: { type: 'string', format: 'date-time', nullable: true },
      escalatedAt: { type: 'string', format: 'date-time', nullable: true },
      escalationCount: { type: 'integer', minimum: 0 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  AuditLog: {
    type: 'object',
    required: ['id', 'action', 'resource', 'createdAt'],
    properties: {
      id: { type: 'string' },
      actorId: { type: 'string', nullable: true },
      action: { type: 'string' },
      resource: { type: 'string' },
      resourceId: { type: 'string', nullable: true },
      payload: { type: 'object', nullable: true },
      prevHash: { type: 'string', nullable: true },
      resultHash: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  ChainReport: {
    type: 'object',
    required: ['totalRows', 'broken', 'firstBrokenAt', 'firstBrokenId'],
    properties: {
      totalRows: { type: 'integer' },
      broken: { type: 'integer' },
      firstBrokenAt: { type: 'integer', nullable: true },
      firstBrokenId: { type: 'string', nullable: true },
    },
  },
  AiRiskResponse: {
    type: 'object',
    required: ['inspectionId', 'score', 'reasons'],
    properties: {
      inspectionId: { type: 'string' },
      score: { type: 'number', minimum: 0, maximum: 1 },
      reasons: { type: 'array', items: { type: 'string' } },
      alertId: { type: 'string', nullable: true },
    },
  },
  DashboardSummary: {
    type: 'object',
    required: ['mines', 'inspections', 'alerts', 'violations', 'reports'],
    properties: {
      mines: { type: 'object', properties: { total: { type: 'integer' }, active: { type: 'integer' } } },
      inspections: { type: 'object', properties: { total: { type: 'integer' }, overdue: { type: 'integer' }, completed: { type: 'integer' } } },
      alerts: { type: 'object', properties: { total: { type: 'integer' }, open: { type: 'integer' }, critical: { type: 'integer' } } },
      violations: { type: 'object', properties: { total: { type: 'integer' }, open: { type: 'integer' }, critical: { type: 'integer' } } },
      reports: { type: 'object', properties: { total: { type: 'integer' }, submitted: { type: 'integer' }, approved: { type: 'integer' } } },
    },
  },
  WorkflowRun: {
    type: 'object',
    required: ['triggered', 'createdAt'],
    properties: {
      triggered: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['INSPECTION_OVERDUE', 'REPEATED_VIOLATIONS', 'HIGH_AI_RISK', 'MISSING_REPORT', 'ENVIRONMENTAL_THRESHOLD'] },
            count: { type: 'integer' },
            alertIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  PaginatedAlerts: {
    type: 'object',
    required: ['items', 'page', 'pageSize', 'total'],
    properties: {
      items: { type: 'array', items: { $ref: '#/components/schemas/Alert' } },
      page: { type: 'integer' },
      pageSize: { type: 'integer' },
      total: { type: 'integer' },
    },
  },
};

// Re-usable request bodies
const REQ_BODIES = {
  LoginBody: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } },
  RegisterBody: {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password' },
      name: { type: 'string' },
      role: { $ref: '#/components/schemas/Role' },
      mineId: { type: 'string' },
    },
  },
  CreateMineBody: { type: 'object', required: ['name', 'code', 'location'], properties: { name: { type: 'string' }, code: { type: 'string' }, location: { type: 'string' }, region: { type: 'string' }, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] }, complianceScore: { type: 'number', minimum: 0, maximum: 100 } } },
  UpdateMineBody: { type: 'object', properties: { name: { type: 'string' }, code: { type: 'string' }, location: { type: 'string' }, region: { type: 'string' }, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] }, complianceScore: { type: 'number', minimum: 0, maximum: 100 } } },
  CreateInspectionBody: { type: 'object', required: ['mineId', 'scheduledDate'], properties: { mineId: { type: 'string' }, inspectorId: { type: 'string' }, type: { type: 'string', enum: ['SAFETY', 'ENVIRONMENTAL', 'EQUIPMENT', 'COMPLIANCE', 'ROUTINE'] }, status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE'] }, scheduledDate: { type: 'string', format: 'date-time' }, completedDate: { type: 'string', format: 'date-time', nullable: true }, summary: { type: 'string' }, findings: { type: 'object' }, riskScore: { type: 'number', minimum: 0, maximum: 1 }, riskReasons: { type: 'array', items: { type: 'string' } } } },
  UpdateInspectionBody: { type: 'object', properties: { mineId: { type: 'string' }, inspectorId: { type: 'string' }, type: { type: 'string', enum: ['SAFETY', 'ENVIRONMENTAL', 'EQUIPMENT', 'COMPLIANCE', 'ROUTINE'] }, status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE'] }, scheduledDate: { type: 'string', format: 'date-time' }, completedDate: { type: 'string', format: 'date-time', nullable: true }, summary: { type: 'string' }, findings: { type: 'object' }, riskScore: { type: 'number', minimum: 0, maximum: 1 }, riskReasons: { type: 'array', items: { type: 'string' } } } },
  CreateAlertBody: { type: 'object', required: ['title', 'message'], properties: { type: { type: 'string', enum: ['INSPECTION_OVERDUE', 'REPEATED_VIOLATIONS', 'HIGH_AI_RISK', 'MISSING_REPORT', 'ENVIRONMENTAL_THRESHOLD', 'MANUAL'] }, severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }, status: { type: 'string', enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] }, title: { type: 'string' }, message: { type: 'string' }, mineId: { type: 'string', nullable: true }, inspectionId: { type: 'string', nullable: true }, violationId: { type: 'string', nullable: true }, reportId: { type: 'string', nullable: true }, triggerData: { type: 'object', nullable: true }, assignedToId: { type: 'string', nullable: true }, dueDate: { type: 'string', format: 'date-time', nullable: true } } },
  UpdateAlertBody: { type: 'object', properties: { type: { type: 'string', enum: ['INSPECTION_OVERDUE', 'REPEATED_VIOLATIONS', 'HIGH_AI_RISK', 'MISSING_REPORT', 'ENVIRONMENTAL_THRESHOLD', 'MANUAL'] }, severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }, status: { type: 'string', enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] }, title: { type: 'string' }, message: { type: 'string' }, mineId: { type: 'string', nullable: true }, inspectionId: { type: 'string', nullable: true }, violationId: { type: 'string', nullable: true }, reportId: { type: 'string', nullable: true }, triggerData: { type: 'object', nullable: true }, assignedToId: { type: 'string', nullable: true }, dueDate: { type: 'string', format: 'date-time', nullable: true } } },
  CreateReportBody: { type: 'object', required: ['mineId', 'type', 'title', 'body', 'periodStart', 'periodEnd'], properties: { mineId: { type: 'string' }, type: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'INCIDENT', 'COMPLIANCE'] }, title: { type: 'string' }, body: { type: 'string' }, periodStart: { type: 'string', format: 'date-time' }, periodEnd: { type: 'string', format: 'date-time' } } },
  UpdateReportBody: { type: 'object', properties: { type: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'INCIDENT', 'COMPLIANCE'] }, status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] }, title: { type: 'string' }, body: { type: 'string' }, periodStart: { type: 'string', format: 'date-time' }, periodEnd: { type: 'string', format: 'date-time' } } },
  CreateViolationBody: { type: 'object', required: ['mineId', 'code', 'description'], properties: { mineId: { type: 'string' }, inspectionId: { type: 'string', nullable: true }, severity: { type: 'string', enum: ['MINOR', 'MAJOR', 'CRITICAL'] }, status: { type: 'string', enum: ['OPEN', 'NOTIFIED', 'RECTIFIED', 'ESCALATED', 'CLOSED'] }, code: { type: 'string' }, description: { type: 'string' }, penaltyAmount: { type: 'number', minimum: 0 } } },
  UpdateViolationBody: { type: 'object', properties: { mineId: { type: 'string' }, inspectionId: { type: 'string', nullable: true }, severity: { type: 'string', enum: ['MINOR', 'MAJOR', 'CRITICAL'] }, status: { type: 'string', enum: ['OPEN', 'NOTIFIED', 'RECTIFIED', 'ESCALATED', 'CLOSED'] }, code: { type: 'string' }, description: { type: 'string' }, penaltyAmount: { type: 'number', minimum: 0 } } },
  AiRiskBody: { type: 'object', required: ['inspectionId'], properties: { inspectionId: { type: 'string' }, summary: { type: 'string' }, findings: { type: 'object' } } },
  EnvironmentalReadingBody: { type: 'object', required: ['mineId', 'parameter', 'value', 'unit'], properties: { mineId: { type: 'string' }, parameter: { type: 'string' }, value: { type: 'number' }, unit: { type: 'string' }, threshold: { type: 'number' } } },
  CopilotChatBody: { type: 'object', required: ['message'], properties: { message: { type: 'string', maxLength: 2000 }, history: { type: 'array', items: { type: 'object', properties: { role: { type: 'string', enum: ['user', 'assistant'] }, content: { type: 'string' } } } }, context: { type: 'object', properties: { lastMineIds: { type: 'array', items: { type: 'string' } }, focusedMineId: { type: 'string' } } } } },
};

// ---------------------------------------------------------------------------
// Endpoint registry
// ---------------------------------------------------------------------------

const ENDPOINTS: EndpointSpec[] = [
  // ----- Auth -----
  { method: 'post', path: '/api/auth/login', summary: 'Login with email + password', tags: ['Auth'], body: { required: true, schemaRef: 'LoginBody' }, responses: [ { status: 200, description: 'Authenticated', schemaRef: 'AuthLoginResponse' }, { status: 401, description: 'Invalid credentials', schemaRef: 'ApiErr' } ] },
  { method: 'post', path: '/api/auth/register', summary: 'Register a new user (CORPORATE_ADMIN only)', tags: ['Auth'], auth: true, roles: ['CORPORATE_ADMIN'], body: { required: true, schemaRef: 'RegisterBody' }, responses: [ { status: 201, description: 'Created', schemaRef: 'User' }, { status: 403, description: 'Forbidden', schemaRef: 'ApiErr' }, { status: 409, description: 'Email already registered', schemaRef: 'ApiErr' } ] },
  { method: 'post', path: '/api/auth/refresh', summary: 'Issue a new access token using the refresh-token cookie', tags: ['Auth'], body: { required: false, schemaRef: 'RefreshBody' }, responses: [ { status: 200, description: 'New access token', schemaRef: 'AuthLoginResponse' }, { status: 401, description: 'Invalid or expired refresh token', schemaRef: 'ApiErr' } ] },
  { method: 'post', path: '/api/auth/logout', summary: 'Revoke the refresh token and clear the cookie', tags: ['Auth'], auth: false, responses: [ { status: 204, description: 'Logged out' } ] },
  { method: 'get',  path: '/api/auth/me', summary: 'Return the currently authenticated user', tags: ['Auth'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], responses: [ { status: 200, description: 'Current user', schemaRef: 'User' }, { status: 401, description: 'Unauthenticated', schemaRef: 'ApiErr' } ] },

  // ----- Mines -----
  { method: 'get',    path: '/api/mines', summary: 'List mines (role-scoped)', tags: ['Mines'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } }, { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', default: 20 } }, { name: 'search', in: 'query', required: false, schema: { type: 'string' } } ], responses: [ { status: 200, description: 'Paginated mines', schemaRef: 'PaginatedAlerts' } ] },
  { method: 'post',   path: '/api/mines', summary: 'Create a mine', tags: ['Mines'], auth: true, roles: ['CORPORATE_ADMIN'], body: { required: true, schemaRef: 'CreateMineBody' }, responses: [ { status: 201, description: 'Created', schemaRef: 'Mine' }, { status: 403, description: 'Forbidden', schemaRef: 'ApiErr' }, { status: 409, description: 'Code already in use', schemaRef: 'ApiErr' } ] },
  { method: 'get',    path: '/api/mines/{id}', summary: 'Get one mine', tags: ['Mines'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Mine ID' } ], responses: [ { status: 200, description: 'Mine', schemaRef: 'Mine' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'patch',  path: '/api/mines/{id}', summary: 'Update a mine', tags: ['Mines'], auth: true, roles: ['CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], body: { required: true, schemaRef: 'UpdateMineBody' }, responses: [ { status: 200, description: 'Updated', schemaRef: 'Mine' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'delete', path: '/api/mines/{id}', summary: 'Delete a mine', tags: ['Mines'], auth: true, roles: ['CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 204, description: 'Deleted' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'get',    path: '/api/mines/{id}/compliance-report', summary: 'Download a statutory compliance report PDF for one mine', description: 'Returns `application/pdf` (not the JSON envelope) with mine particulars, a compliance summary, and inspection, violation, alert, and environmental-reading history. Each table is capped at the most recent 250 rows. MINE_OFFICIAL may only export their own mine. Every export is recorded in the audit log.', tags: ['Reports'], auth: true, roles: ['MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Mine ID' } ], responses: [ { status: 200, description: 'PDF document (application/pdf)' }, { status: 403, description: 'Forbidden for this role or mine', schemaRef: 'ApiErr' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },

  // ----- Inspections -----
  { method: 'get',    path: '/api/inspections', summary: 'List inspections (role-scoped)', tags: ['Inspections'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'mineId', in: 'query', required: false, schema: { type: 'string' } }, { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE'] } }, { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } }, { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', default: 20 } } ], responses: [ { status: 200, description: 'Paginated inspections' } ] },
  { method: 'post',   path: '/api/inspections', summary: 'Create an inspection', tags: ['Inspections'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN'], body: { required: true, schemaRef: 'CreateInspectionBody' }, responses: [ { status: 201, description: 'Created', schemaRef: 'Inspection' }, { status: 403, description: 'Forbidden for this mine', schemaRef: 'ApiErr' } ] },
  { method: 'get',    path: '/api/inspections/{id}', summary: 'Get one inspection', tags: ['Inspections'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 200, description: 'Inspection', schemaRef: 'Inspection' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'patch',  path: '/api/inspections/{id}', summary: 'Update an inspection', tags: ['Inspections'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], body: { required: true, schemaRef: 'UpdateInspectionBody' }, responses: [ { status: 200, description: 'Updated', schemaRef: 'Inspection' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'delete', path: '/api/inspections/{id}', summary: 'Delete an inspection', tags: ['Inspections'], auth: true, roles: ['CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 204, description: 'Deleted' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },

  // ----- Alerts -----
  { method: 'get',    path: '/api/alerts', summary: 'List alerts (role-scoped)', tags: ['Alerts'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'mineId', in: 'query', required: false, schema: { type: 'string' } }, { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] } }, { name: 'severity', in: 'query', required: false, schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] } }, { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } }, { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', default: 20 } } ], responses: [ { status: 200, description: 'Paginated alerts', schemaRef: 'PaginatedAlerts' } ] },
  { method: 'post',   path: '/api/alerts', summary: 'Create a manual alert', tags: ['Alerts'], auth: true, roles: ['MINE_OFFICIAL', 'CORPORATE_ADMIN'], body: { required: true, schemaRef: 'CreateAlertBody' }, responses: [ { status: 201, description: 'Created', schemaRef: 'Alert' } ] },
  { method: 'get',    path: '/api/alerts/{id}', summary: 'Get one alert', tags: ['Alerts'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 200, description: 'Alert', schemaRef: 'Alert' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'patch',  path: '/api/alerts/{id}', summary: 'Update alert status / acknowledgement', tags: ['Alerts'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], body: { required: true, schemaRef: 'UpdateAlertBody' }, responses: [ { status: 200, description: 'Updated', schemaRef: 'Alert' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'delete', path: '/api/alerts/{id}', summary: 'Delete an alert', tags: ['Alerts'], auth: true, roles: ['CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 204, description: 'Deleted' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },

  // ----- Reports -----
  { method: 'get',    path: '/api/reports', summary: 'List reports (role-scoped)', tags: ['Reports'], auth: true, roles: ['MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'mineId', in: 'query', required: false, schema: { type: 'string' } }, { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] } }, { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } } ], responses: [ { status: 200, description: 'Paginated reports' } ] },
  { method: 'post',   path: '/api/reports', summary: 'Create a report', tags: ['Reports'], auth: true, roles: ['MINE_OFFICIAL', 'CORPORATE_ADMIN'], body: { required: true, schemaRef: 'CreateReportBody' }, responses: [ { status: 201, description: 'Created', schemaRef: 'Report' } ] },
  { method: 'get',    path: '/api/reports/{id}', summary: 'Get one report', tags: ['Reports'], auth: true, roles: ['MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 200, description: 'Report', schemaRef: 'Report' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'patch',  path: '/api/reports/{id}', summary: 'Update a report (incl. submit/approve)', tags: ['Reports'], auth: true, roles: ['MINE_OFFICIAL', 'CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], body: { required: true, schemaRef: 'UpdateReportBody' }, responses: [ { status: 200, description: 'Updated', schemaRef: 'Report' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'delete', path: '/api/reports/{id}', summary: 'Delete a report', tags: ['Reports'], auth: true, roles: ['CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 204, description: 'Deleted' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },

  // ----- Violations -----
  { method: 'get',    path: '/api/violations', summary: 'List violations (role-scoped)', tags: ['Violations'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'mineId', in: 'query', required: false, schema: { type: 'string' } }, { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['OPEN', 'NOTIFIED', 'RECTIFIED', 'ESCALATED', 'CLOSED'] } }, { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } } ], responses: [ { status: 200, description: 'Paginated violations' } ] },
  { method: 'post',   path: '/api/violations', summary: 'Issue a violation', tags: ['Violations'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN'], body: { required: true, schemaRef: 'CreateViolationBody' }, responses: [ { status: 201, description: 'Created', schemaRef: 'Violation' } ] },
  { method: 'get',    path: '/api/violations/{id}', summary: 'Get one violation', tags: ['Violations'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 200, description: 'Violation', schemaRef: 'Violation' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'patch',  path: '/api/violations/{id}', summary: 'Update a violation (incl. escalate)', tags: ['Violations'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], body: { required: true, schemaRef: 'UpdateViolationBody' }, responses: [ { status: 200, description: 'Updated', schemaRef: 'Violation' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'delete', path: '/api/violations/{id}', summary: 'Delete a violation', tags: ['Violations'], auth: true, roles: ['CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 204, description: 'Deleted' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },

  // ----- Audit logs -----
  { method: 'get',  path: '/api/audit-logs', summary: 'List audit logs (REGULATOR + CORPORATE_ADMIN)', tags: ['Audit'], auth: true, roles: ['REGULATOR', 'CORPORATE_ADMIN'], params: [ { name: 'action', in: 'query', required: false, schema: { type: 'string' } }, { name: 'resource', in: 'query', required: false, schema: { type: 'string' } }, { name: 'actorId', in: 'query', required: false, schema: { type: 'string' } }, { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } } ], responses: [ { status: 200, description: 'Paginated audit logs' } ] },
  { method: 'get',  path: '/api/audit-logs/{id}', summary: 'Get one audit log', tags: ['Audit'], auth: true, roles: ['REGULATOR', 'CORPORATE_ADMIN'], params: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ], responses: [ { status: 200, description: 'Audit log', schemaRef: 'AuditLog' }, { status: 404, description: 'Not found', schemaRef: 'ApiErr' } ] },
  { method: 'post', path: '/api/audit-logs/verify', summary: 'Verify the integrity of the audit log chain', tags: ['Audit'], auth: true, roles: ['REGULATOR', 'CORPORATE_ADMIN'], responses: [ { status: 200, description: 'Chain report', schemaRef: 'ChainReport' } ] },

  // ----- AI risk -----
  { method: 'post', path: '/api/ai/risk-score', summary: 'Compute an AI risk score for an inspection (0..1) and create a HIGH_AI_RISK alert if score >= 0.8', tags: ['AI'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN'], body: { required: true, schemaRef: 'AiRiskBody' }, responses: [ { status: 200, description: 'Risk assessment', schemaRef: 'AiRiskResponse' } ] },

  // ----- Dashboard -----
  { method: 'get', path: '/api/dashboard/summary', summary: 'Role-scoped dashboard KPIs', tags: ['Dashboard'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], responses: [ { status: 200, description: 'Summary', schemaRef: 'DashboardSummary' } ] },

  // ----- Workflow -----
  { method: 'post', path: '/api/workflow/run', summary: 'Run all 5 escalation triggers. Protected by x-cron-secret header. Does NOT require JWT.', tags: ['Workflow'], params: [ { name: 'x-cron-secret', in: 'header', required: true, schema: { type: 'string' }, description: 'Must match env CRON_SECRET' } ], responses: [ { status: 200, description: 'Run report', schemaRef: 'WorkflowRun' }, { status: 401, description: 'Missing or wrong x-cron-secret', schemaRef: 'ApiErr' } ] },

  // ----- Environmental readings -----
  { method: 'post', path: '/api/environmental-readings', summary: 'Record an environmental reading for a mine (used by the environmental-threshold workflow trigger)', tags: ['Environmental'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN'], body: { required: true, schemaRef: 'EnvironmentalReadingBody' }, responses: [ { status: 201, description: 'Created reading' } ] },
  { method: 'get',  path: '/api/environmental-readings', summary: 'List environmental readings (role-scoped)', tags: ['Environmental'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], params: [ { name: 'mineId', in: 'query', required: false, schema: { type: 'string' } }, { name: 'parameter', in: 'query', required: false, schema: { type: 'string' } } ], responses: [ { status: 200, description: 'Paginated readings' } ] },

  // ----- Copilot -----
  { method: 'post', path: '/api/copilot/chat', summary: 'Ask PRAHARI Copilot a question in natural language', description: 'Runs deterministic intent detection and RBAC-scoped retrieval against the existing mines/inspections/violations/alerts/environmental-readings/reports data, then streams a Groq-generated answer grounded strictly in the retrieved records. Response is newline-delimited JSON (not the {ok,data} envelope): each line is {type:"context",data:RetrievalResult} | {type:"token",text} | {type:"done"} | {type:"error",message}. Every query is written to the audit log.', tags: ['AI'], auth: true, roles: ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR'], body: { required: true, schemaRef: 'CopilotChatBody' }, responses: [ { status: 200, description: 'application/x-ndjson stream' }, { status: 400, description: 'Invalid request', schemaRef: 'ApiErr' } ] },

  // ----- OpenAPI meta -----
  { method: 'get', path: '/api/docs', summary: 'OpenAPI 3.1 spec as JSON', tags: ['Meta'], responses: [ { status: 200, description: 'OpenAPI 3.1 JSON document' } ] },
  { method: 'get', path: '/api/health', summary: 'Liveness and database connectivity check (no auth)', tags: ['Meta'], responses: [ { status: 200, description: 'Service and database are up' }, { status: 503, description: 'Database unreachable', schemaRef: 'ApiErr' } ] },
];

// ---------------------------------------------------------------------------
// Build the spec
// ---------------------------------------------------------------------------

const securitySchemeBearer = {
  type: 'http' as const,
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Use `Authorization: Bearer <access_token>`. Obtain via POST /api/auth/login.',
};

export function getOpenApiSpec() {
  const paths: Record<string, Record<HttpMethod, Record<string, unknown>>> = {};
  for (const e of ENDPOINTS) {
    const parameters = (e.params ?? []).map(p => ({
      name: p.name,
      in: p.in,
      required: p.required,
      schema: p.schema,
      ...(p.description ? { description: p.description } : {}),
    }));
    const responses: Record<string, Record<string, unknown>> = {};
    for (const r of e.responses) {
      responses[String(r.status)] = {
        description: r.description,
        ...(r.schemaRef ? { content: { 'application/json': { schema: { $ref: `#/components/schemas/${r.schemaRef}` } } } } : {}),
      };
    }
    const operation: Record<string, unknown> = {
      tags: e.tags,
      summary: e.summary,
      ...(e.description ? { description: e.description } : {}),
      ...(parameters.length ? { parameters } : {}),
      ...(e.body ? {
        requestBody: {
          required: e.body.required,
          ...(e.body.description ? { description: e.body.description } : {}),
          content: { 'application/json': { schema: { $ref: `#/components/requestBodies/${e.body.schemaRef}` } } },
        },
      } : {}),
      responses,
      security: e.auth ? [{ bearerAuth: [] }] : [],
    };
    paths[e.path] = paths[e.path] ?? {};
    paths[e.path][e.method] = operation;
  }

  // Build requestBodies — for schemas that are simple objects (no refs).
  const requestBodies: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(REQ_BODIES)) {
    requestBodies[k] = {
      content: { 'application/json': { schema: v } },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Mining Compliance Management API',
      version: '1.0.0',
      description: [
        'Backend API for the Mining Compliance Management System.',
        '',
        '## Authentication',
        'All endpoints except `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, and `/api/workflow/run` require a JWT access token issued by `/api/auth/login`. Send it as:',
        '',
        '```',
        'Authorization: Bearer <access_token>',
        '```',
        '',
        '## Roles',
        '- `FIELD_INSPECTOR` — performs inspections, views assigned mines, raises violations',
        '- `MINE_OFFICIAL` — manages their mine\'s inspections, reports, violations, alerts',
        '- `CORPORATE_ADMIN` — full access to all mines, plus user registration and approvals',
        '- `REGULATOR` — read-only access to all mines + audit logs',
        '',
        '## Response envelope',
        '```json',
        '{ "ok": true,  "data": <T> }',
        '{ "ok": false, "error": { "code": "<CODE>", "message": "<msg>", "details": <any> } }',
        '```',
        '',
        '## Workflow triggers (cron)',
        'POST /api/workflow/run with header `x-cron-secret: <CRON_SECRET>` runs the 5 escalation triggers:',
        '1. Inspection overdue',
        '2. Repeated violations (3+ in 90 days)',
        '3. High AI risk score (>= 0.8)',
        '4. Missing mandatory report (no report in last 30 days for an active mine)',
        '5. Environmental threshold crossed',
        'Each trigger creates an `Alert` of the appropriate type.',
      ].join('\n'),
    },
    servers: [
      { url: '/', description: 'This server' },
    ],
    components: {
      securitySchemes: { bearerAuth: securitySchemeBearer },
      schemas: SCHEMAS,
      requestBodies,
    },
    paths,
    security: [],
  };
}
