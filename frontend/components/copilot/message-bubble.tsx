import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { MarkdownLite } from './markdown-lite';
import { EvidenceCards } from './evidence-cards';
import { cn } from '@/lib/utils';
import type { CopilotMessage } from '@/types/copilot';

function BrandAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-gold/30">
      <ShieldCheck className="h-4 w-4" aria-hidden />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Copilot is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-primary-soft"
          style={{ animationDelay: `${i * 200}ms`, '--pulse-color': 'oklch(0.72 0.12 152 / 35%)' } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function MessageBubble({ message, userInitials }: { message: CopilotMessage; userInitials: string }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      {isUser ? <Avatar initials={userInitials} size="sm" /> : <BrandAvatar />}
      <div className={cn('flex min-w-0 max-w-[44rem] flex-1 flex-col gap-2', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-xl px-4 py-3',
            isUser ? 'bg-primary text-primary-foreground' : 'border border-border bg-card',
          )}
        >
          {isUser ? (
            <p className="text-body whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <MarkdownLite text={message.content} />
          ) : message.streaming ? (
            <TypingDots />
          ) : null}
          {message.errorMessage && (
            <p className="text-caption mt-2 flex items-center gap-1.5 text-danger">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {message.errorMessage}
            </p>
          )}
        </div>
        {!isUser && message.retrieval && <EvidenceCards retrieval={message.retrieval} />}
      </div>
    </div>
  );
}
