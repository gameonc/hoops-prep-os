type Props = {
  score: number;
  size?: number;
  subtitle?: string;
};

/**
 * Circular readiness dial. 0-100 score, banded PRIME/READY/MODERATE/LOW/DEPLETED.
 * Fully self-contained SVG, no chart lib.
 */
export default function ReadinessDial({ score, size = 220, subtitle }: Props) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const band =
    s >= 80 ? { label: "PRIME",     color: "#22c55e" } :
    s >= 65 ? { label: "READY",     color: "#84cc16" } :
    s >= 50 ? { label: "MODERATE",  color: "#f59e0b" } :
    s >= 35 ? { label: "LOW",       color: "#f97316" } :
              { label: "DEPLETED",  color: "#ef4444" };

  const R = size / 2 - 20;
  const C = 2 * Math.PI * R;
  const filled = (s / 100) * C;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="rounded-xl border border-court-border p-4 bg-court-surface flex flex-col items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={R} stroke="#1f1f26" strokeWidth="18" fill="none" />
        <circle
          cx={cx} cy={cy} r={R}
          stroke={band.color} strokeWidth="18" fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${C - filled}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy + size * 0.02} textAnchor="middle"
              fontSize={size * 0.22} fill="#e8e8ea" fontWeight="700">{s}</text>
        <text x={cx} y={cy + size * 0.14} textAnchor="middle"
              fontSize={size * 0.055} fill={band.color} fontWeight="600" letterSpacing="2">
          {band.label}
        </text>
      </svg>
      <div className="text-xs text-court-muted mt-1">
        {subtitle ?? "Readiness"}
      </div>
    </div>
  );
}
