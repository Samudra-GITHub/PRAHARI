// A deliberately tiny renderer for the Copilot's constrained output shape
// (bold section headings, short paragraphs, "- " bullet lists — see the
// system prompt in backend/src/lib/copilot/groq.ts). Not a general Markdown
// parser — pulling in a full Markdown/remark dependency for three
// constructs would be the "unnecessary library" the brief asks to avoid.

import type { ReactNode } from 'react';

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList(key: string) {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key} className="my-1 flex list-disc flex-col gap-1 pl-5">
        {listBuffer.map((item, i) => (
          <li key={i} className="text-body text-foreground/90">
            {renderInline(item, `${key}-li-${i}`)}
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listBuffer.push(trimmed.slice(2));
      return;
    }
    flushList(`list-${idx}`);
    if (trimmed.length === 0) return;
    blocks.push(
      <p key={`p-${idx}`} className="text-body text-foreground/90">
        {renderInline(trimmed, `p-${idx}`)}
      </p>,
    );
  });
  flushList('list-end');

  return <div className="flex flex-col gap-1.5">{blocks}</div>;
}
