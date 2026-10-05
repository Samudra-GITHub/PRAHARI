'use client';

import { useEffect, useRef } from 'react';
import { BrainCircuit } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { ChatInput } from './chat-input';
import { QuickPrompts } from './quick-prompts';
import { BrandMark } from '@/components/shell/brand-mark';
import type { CopilotMessage } from '@/types/copilot';

export function ChatThread({
  messages,
  streaming,
  userInitials,
  onSend,
  onStop,
}: {
  messages: CopilotMessage[];
  streaming: boolean;
  userInitials: string;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-12 text-center">
            <BrandMark size="lg" />
            <div className="flex flex-col gap-1.5">
              <h2 className="text-display flex items-center justify-center gap-2 text-foreground">
                <BrainCircuit className="h-5 w-5 text-primary-soft" aria-hidden />
                PRAHARI Copilot
              </h2>
              <p className="text-body max-w-md text-muted-foreground">
                Ask about mine status, inspections, violations, alerts, environmental readings, or compliance reports —
                answers are grounded in PRAHARI’s own records, with sources cited.
              </p>
            </div>
            <div className="w-full max-w-lg">
              <QuickPrompts onPick={onSend} />
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} userInitials={userInitials} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <ChatInput onSend={onSend} onStop={onStop} streaming={streaming} />
      </div>
    </div>
  );
}
