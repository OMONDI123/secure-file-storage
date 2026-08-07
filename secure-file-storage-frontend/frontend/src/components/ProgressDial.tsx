interface DialProps {
  percent: number; // 0-100
  size?: number;
  label?: string;
}

/**
 * Renders upload progress as a safe-combination dial rather than a linear bar —
 * tick marks around the ring, a sweeping indicator, and the percentage at center.
 */
export function ProgressDial({ percent, size = 96, label }: DialProps) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  const ticks = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 2 * Math.PI - Math.PI / 2;
    const inner = radius - 4;
    const outer = radius + 2;
    const x1 = center + inner * Math.cos(angle);
    const y1 = center + inner * Math.sin(angle);
    const x2 = center + outer * Math.cos(angle);
    const y2 = center + outer * Math.sin(angle);
    return { x1, y1, x2, y2, active: i / 24 <= clamped / 100 };
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-ink-700)" strokeWidth={2} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-brass-400)"
          strokeWidth={2.5}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-200 ease-out"
        />
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.active ? "var(--color-brass-300)" : "var(--color-ink-600)"}
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-semibold text-ink-100">{clamped}%</span>
        {label && <span className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-400">{label}</span>}
      </div>
    </div>
  );
}
