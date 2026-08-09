interface DialProps {
  percent: number; // 0-100
  size?: number;
  label?: string;
}

/** Circular upload-progress indicator. */
export function ProgressDial({ percent, size = 84, label }: DialProps) {
  const radius = size / 2 - 7;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-slate-200)" strokeWidth={5} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-primary-500)"
          strokeWidth={5}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-200 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-base font-bold text-slate-900">{clamped}%</span>
        {label && <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>}
      </div>
    </div>
  );
}
