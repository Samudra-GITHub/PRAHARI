'use client';

// PRAHARI Copilot — the AI Intelligence Officer experience. Backed entirely
// by POST /api/copilot/chat (backend/src/app/api/copilot/chat), which does
// real RBAC-scoped retrieval against the existing mines/inspections/
// violations/alerts/environmental-readings/reports data and streams a
// Groq-generated answer grounded in it. This page owns none of that logic —
// it's composition of hooks/use-copilot-chat.ts (conversation state) and
// components/copilot/* (presentation) only.

import { useState } from 'react';
import { History, Radar, X } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCopilotChat } from '@/hooks/use-copilot-chat';
import { SessionSidebar } from '@/components/copilot/session-sidebar';
import { ChatThread } from '@/components/copilot/chat-thread';
import { MineContextPanel } from '@/components/copilot/mine-context-panel';
import { Button } from '@/components/ui/button';
import { initials } from '@/lib/format';

export default function CopilotPage() {
  const { user } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  const copilot = useCopilotChat(user?.id ?? 'anonymous');

  if (!user) return null;

  // Closes the mobile history drawer whenever a session is actually picked,
  // so switching a conversation doesn't leave the overlay sitting on top of it.
  function selectSessionAndClose(id: string) {
    copilot.selectSession(id);
    setHistoryOpen(false);
  }

  const messages = copilot.active?.messages ?? [];

  return (
    <div className="flex h-[calc(100svh-7rem)] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-border bg-background">
      {/* Mobile toolbar — the two side panels become slide-over drawers below lg. */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 lg:hidden">
        <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
          <History className="h-4 w-4" /> History
        </Button>
        <span className="text-eyebrow text-muted-foreground">PRAHARI Copilot</span>
        <Button variant="ghost" size="sm" onClick={() => setContextOpen(true)}>
          <Radar className="h-4 w-4" /> Context
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:block lg:w-72 lg:shrink-0">
          <SessionSidebar
            sessions={copilot.sessions}
            activeId={copilot.active?.id ?? null}
            onSelect={copilot.selectSession}
            onNew={copilot.startNewChat}
            onDelete={copilot.deleteSession}
            onPickPrompt={copilot.sendMessage}
          />
        </div>

        <ChatThread
          messages={messages}
          streaming={copilot.streaming}
          userInitials={initials(user.name)}
          onSend={copilot.sendMessage}
          onStop={copilot.stop}
        />

        <div className="hidden xl:block xl:w-80 xl:shrink-0">
          <MineContextPanel messages={messages} />
        </div>
      </div>

      {/* Mobile history drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Conversation history">
          <button aria-label="Close" className="absolute inset-0 bg-background/80" onClick={() => setHistoryOpen(false)} />
          <div className="animate-slide-in relative h-full w-72 shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-end border-b border-border p-2">
                <Button variant="ghost" size="icon-sm" onClick={() => setHistoryOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SessionSidebar
                sessions={copilot.sessions}
                activeId={copilot.active?.id ?? null}
                onSelect={selectSessionAndClose}
                onNew={() => {
                  copilot.startNewChat();
                  setHistoryOpen(false);
                }}
                onDelete={copilot.deleteSession}
                onPickPrompt={(p) => {
                  copilot.sendMessage(p);
                  setHistoryOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile mine-context drawer */}
      {contextOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Live mine context">
          <button aria-label="Close" className="absolute inset-0 bg-background/80" onClick={() => setContextOpen(false)} />
          <div className="animate-slide-in-right absolute right-0 top-0 h-full w-80 shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-start border-b border-border p-2">
                <Button variant="ghost" size="icon-sm" onClick={() => setContextOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <MineContextPanel messages={messages} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
