const QUICK_PROMPTS = [
  'Which mine is at highest risk today?',
  "Show today's alerts",
  'Generate a compliance summary',
  'Show environmental violations this week',
  'Show overdue inspections',
  'Explain the risk score for the highest-risk mine',
  'Show open critical violations',
  'Generate a compliance report',
];

export function QuickPrompts({ onPick, compact = false }: { onPick: (prompt: string) => void; compact?: boolean }) {
  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'grid grid-cols-1 gap-2 sm:grid-cols-2'}>
      {QUICK_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onPick(prompt)}
          className="hover-lift rounded-md border border-border bg-surface-raised/40 px-3 py-2 text-left text-caption text-foreground/80 transition-colors duration-150 hover:border-border-strong hover:bg-surface-raised"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
