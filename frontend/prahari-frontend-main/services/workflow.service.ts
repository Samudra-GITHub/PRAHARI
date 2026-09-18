// backend/src/app/api/workflow/run/** — runs all 5 escalation triggers.
// Protected by an `x-cron-secret` header matching the backend's CRON_SECRET
// env var, NOT by a JWT (backend/src/app/api/workflow/run/route.ts). This is
// meant to be invoked by a scheduler, not by a logged-in user — only wire it
// into an admin/ops surface if one is ever built.

import { api } from '@/lib/api';
import type { WorkflowRunResult } from '@/types/models';

export function runWorkflowTriggers(cronSecret: string): Promise<WorkflowRunResult> {
  return api.post<WorkflowRunResult>('/api/workflow/run', undefined, {
    auth: false,
    headers: { 'x-cron-secret': cronSecret },
  });
}
