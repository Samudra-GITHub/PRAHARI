// POST /api/copilot/chat
//
// PRAHARI Copilot's single endpoint. Pipeline:
//   auth (requireRole, same as every other route)
//     -> detectIntent() + entity extraction (nlu.ts, deterministic)
//     -> retrieve() against the real DB, RBAC-scoped exactly like the
//        equivalent REST routes (retrieval.ts)
//     -> audit() the query
//     -> stream a Groq completion that may only narrate RETRIEVED_DATA
//
// Response is newline-delimited JSON (not the usual {ok,data} envelope,
// same precedent as the PDF route returning a raw body): each line is one
// of {type:'context',data}, {type:'token',text}, {type:'done'}, or
// {type:'error',message}. The 'context' line carries the full, real
// RetrievalResult so the UI can render evidence/cards immediately without
// waiting on — or trusting — the model's prose for any number.

import type { NextRequest } from 'next/server';
import { bad } from '@/lib/http';
import { requireRole, type MyRequest } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { CopilotChatBody } from '@/lib/validators';
import { detectIntent } from '@/lib/copilot/nlu';
import { listAccessibleMines, retrieve } from '@/lib/copilot/retrieval';
import { streamCopilotAnswer } from '@/lib/copilot/groq';

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['FIELD_INSPECTOR', 'MINE_OFFICIAL', 'CORPORATE_ADMIN', 'REGULATOR']);
  if (!guard.ok) return guard.response;
  const me = (guard.req as MyRequest).user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Request body must be valid JSON', 'INVALID_JSON');
  }
  const parsed = CopilotChatBody.safeParse(body);
  if (!parsed.success) {
    return bad('Invalid copilot request', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  const { message, history = [], context = {} } = parsed.data;

  const mines = await listAccessibleMines(me);
  const nlu = detectIntent(message, mines, context);
  const retrieval = await retrieve(nlu, me, context);

  await audit({
    actorId: me.id,
    action: 'COPILOT_QUERY',
    resource: 'Copilot',
    resourceId: null,
    payload: {
      message: message.slice(0, 500),
      intent: retrieval.intent,
      evidence: retrieval.evidence.map((e) => `${e.type}:${e.id}`),
    },
  });

  const encoder = new TextEncoder();
  const ndjson = (obj: unknown) => encoder.encode(JSON.stringify(obj) + '\n');

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(ndjson({ type: 'context', data: retrieval }));

      // A denied or empty-evidence turn still gets a plain, honest line
      // instead of spending a model call narrating nothing.
      if (retrieval.deniedReason) {
        controller.enqueue(ndjson({ type: 'token', text: retrieval.deniedReason }));
        controller.enqueue(ndjson({ type: 'done' }));
        controller.close();
        return;
      }

      try {
        for await (const delta of streamCopilotAnswer({ message, history, retrieval })) {
          controller.enqueue(ndjson({ type: 'token', text: delta }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'The AI model is unavailable right now.';
        controller.enqueue(ndjson({ type: 'error', message: msg }));
      }
      controller.enqueue(ndjson({ type: 'done' }));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
