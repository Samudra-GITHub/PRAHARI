// backend/src/app/api/copilot/chat — the one endpoint that doesn't fit
// lib/api.ts's apiFetch, which always parses a single JSON body: this
// route streams newline-delimited JSON. So, same architectural placement as
// lib/api.ts (a service module, never a component) but its own transport:
// a raw fetch reading the response body incrementally, with the same
// bearer-token + one-time-refresh-on-401 handling apiFetch does.

import { getAccessToken, refreshAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/config';
import type { ChatTurn, ConversationContext, CopilotStreamEvent } from '@/types/copilot';

async function postChat(message: string, history: ChatTurn[], context: ConversationContext, signal?: AbortSignal): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${API_BASE_URL}/api/copilot/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ message, history, context }),
    signal,
  });
}

export async function* streamCopilotChat(
  message: string,
  history: ChatTurn[],
  context: ConversationContext,
  signal?: AbortSignal,
): AsyncGenerator<CopilotStreamEvent> {
  let res = await postChat(message, history, context, signal);

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await postChat(message, history, context, signal);
  }

  if (!res.ok || !res.body) {
    let errMessage = 'Copilot request failed.';
    try {
      const json = await res.json();
      errMessage = json?.error?.message ?? errMessage;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    yield { type: 'error', message: errMessage };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      try {
        yield JSON.parse(line) as CopilotStreamEvent;
      } catch {
        // A partial/malformed line — skip rather than crash the stream.
      }
    }
  }

  const remainder = buffer.trim();
  if (remainder) {
    try {
      yield JSON.parse(remainder) as CopilotStreamEvent;
    } catch {
      // Ignore a trailing partial line.
    }
  }
}
