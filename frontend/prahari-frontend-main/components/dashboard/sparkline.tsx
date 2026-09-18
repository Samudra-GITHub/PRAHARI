// A minimal SVG sparkline over the session's own rolling history of a real
// metric (components/dashboard/dashboard-data-context.tsx) — never a
// fabricated series. Renders a quiet baseline instead of a fake trend line
// until at least two real snapshots exist.

const WIDTH = 96;
const HEIGHT = 28;

export function Sparkline({ values, colorVar = 'var(--primary-soft)' }: { values: (number | null)[]; colorVar?: string }) {
  const points = values.filter((v): v is number => v !== null);

  if (points.length < 2) {
    return (
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} aria-hidden className="overflow-visible opacity-40">
        <line x1={0} y1={HEIGHT - 1} x2={WIDTH} y2={HEIGHT - 1} stroke="currentColor" strokeDasharray="2 3" strokeWidth={1} />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = WIDTH / (points.length - 1);

  const coords = points.map((v, i) => {
    const x = i * step;
    const y = HEIGHT - ((v - min) / range) * (HEIGHT - 4) - 2;
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;
  const gradientId = `spark-fill-${colorVar.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      aria-hidden
      className="overflow-visible"
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorVar} stopOpacity="0.35" />
          <stop offset="100%" stopColor={colorVar} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path d={line} fill="none" stroke={colorVar} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r={2} fill={colorVar} />
    </svg>
  );
}
