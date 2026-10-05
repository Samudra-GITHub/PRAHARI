'use client';

// Conversation state for PRAHARI Copilot. The backend has no chat/thread
// table (adding one would be a schema change this task doesn't authorize),
// so sessions are session-local, persisted per signed-in user in
// localStorage — real conversations, just not synced across devices.
//
// Sends POST /api/copilot/chat (via services/copilot.service.ts) and
// applies the streamed events to the active session's messages.

import { useCallback, useRef, useState } from 'react';
import { streamCopilotChat } from '@/services/copilot.service';
import type { ChatTurn, ConversationContext, CopilotMessage, CopilotSession } from '@/types/copilot';

const STORAGE_PREFIX = 'prahari:copilot:sessions:';
const MAX_SESSIONS = 20;
const HISTORY_TURNS = 8;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function loadSessions(userId: string): CopilotSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CopilotSession[]) : [];
  } catch {
    return [];
  }
}

function saveSessions(userId: string, sessions: CopilotSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // Storage full or unavailable (private browsing) — chat still works for this tab.
  }
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function createSession(): CopilotSession {
  const now = new Date().toISOString();
  return { id: makeId(), title: 'New conversation', messages: [], context: {}, createdAt: now, updatedAt: now };
}

function initSessions(userId: string): CopilotSession[] {
  const loaded = loadSessions(userId);
  return loaded.length > 0 ? loaded : [createSession()];
}

export function useCopilotChat(userId: string) {
  // Lazy initializers read localStorage once at mount rather than in an
  // effect — this component remounts on user change anyway (the app
  // redirects through /login), so a one-time read per mount is correct.
  const [sessions, setSessions] = useState<CopilotSession[]>(() => initSessions(userId));
  const [activeId, setActiveId] = useState<string | null>(() => sessions[0]?.id ?? null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Every mutation goes through this so it always applies to the latest
  // state (not a value captured when sendMessage started) and persists in
  // the same step — important because sendMessage keeps calling this
  // repeatedly as tokens stream in, long after its own closure was created.
  const mutateSession = useCallback(
    (id: string, updater: (s: CopilotSession) => CopilotSession) => {
      setSessions((prev) => {
        const next = prev.map((s) => (s.id === id ? updater(s) : s));
        saveSessions(userId, next);
        return next;
      });
    },
    [userId],
  );

  const active = sessions.find((s) => s.id === activeId) ?? null;

  const startNewChat = useCallback(() => {
    const s = createSession();
    setSessions((prev) => {
      const next = [s, ...prev];
      saveSessions(userId, next);
      return next;
    });
    setActiveId(s.id);
  }, [userId]);

  const selectSession = useCallback((id: string) => setActiveId(id), []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveSessions(userId, next);
        setActiveId((current) => (current === id ? (next[0]?.id ?? null) : current));
        return next;
      });
    },
    [userId],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const sessionId = activeId;
      if (!trimmed || !sessionId || streaming) return;

      const sourceSession = sessions.find((s) => s.id === sessionId);
      const history: ChatTurn[] = (sourceSession?.messages ?? []).slice(-HISTORY_TURNS * 2).map((m) => ({ role: m.role, content: m.content }));
      const requestContext: ConversationContext = sourceSession?.context ?? {};

      const userMsg: CopilotMessage = { id: makeId(), role: 'user', content: trimmed };
      const assistantId = makeId();
      const assistantMsg: CopilotMessage = { id: assistantId, role: 'assistant', content: '', streaming: true };

      mutateSession(sessionId, (s) => ({
        ...s,
        title: s.messages.length === 0 ? trimmed.slice(0, 60) : s.title,
        messages: [...s.messages, userMsg, assistantMsg],
        updatedAt: new Date().toISOString(),
      }));

      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      let resolvedContext: ConversationContext = requestContext;

      try {
        for await (const event of streamCopilotChat(trimmed, history, requestContext, controller.signal)) {
          if (event.type === 'context') {
            resolvedContext = event.data.nextContext ?? requestContext;
            mutateSession(sessionId, (s) => ({
              ...s,
              messages: s.messages.map((m) => (m.id === assistantId ? { ...m, retrieval: event.data } : m)),
            }));
          } else if (event.type === 'token') {
            mutateSession(sessionId, (s) => ({
              ...s,
              messages: s.messages.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m)),
            }));
          } else if (event.type === 'error') {
            mutateSession(sessionId, (s) => ({
              ...s,
              messages: s.messages.map((m) => (m.id === assistantId ? { ...m, errorMessage: event.message } : m)),
            }));
          } else if (event.type === 'done') {
            mutateSession(sessionId, (s) => ({
              ...s,
              context: resolvedContext,
              messages: s.messages.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
              updatedAt: new Date().toISOString(),
            }));
          }
        }
      } catch {
        mutateSession(sessionId, (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, streaming: false, errorMessage: m.errorMessage ?? 'Connection interrupted.' } : m,
          ),
        }));
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [activeId, sessions, streaming, mutateSession],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sessions, active, streaming, sendMessage, startNewChat, selectSession, deleteSession, stop };
}
