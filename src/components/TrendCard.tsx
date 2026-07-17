import SparkLine from "./SparkLine";

type Props = {
  label: string;
  unit: string;
  current: number | null;
  baseline: number | null;
  delta_pct: number | null;
  series: number[];
  direction?: "higher_is_better" | "lower_is_better";
  precision?: number;
};

export default function TrendCard({
  label,
  unit,
  current,
  baseline,
  delta_pct,
  series,
  direction = "higher_is_better",
  precision = 1,
}: Props) {
  const hasData = current != null && Number.isFinite(current);

  // Interpret delta polarity
  const good =
    delta_pct == null
      ? null
      : direction === "higher_is_better"
        ? delta_pct >= 0
        : delta_pct <= 0;

  // Use a green / red palette; muted grey when neutral
  const color =
    good == null ? "#a1a1aa" : good ? "#22c55e" : "#ef4444";
  const fill =
    good == null ? "rgba(161,161,170,0.10)"
    : good ? "rgba(34,197,94,0.12)"
    : "rgba(239,68,68,0.12)";

  const deltaTxt =
    delta_pct == null || !Number.isFinite(delta_pct)
      ? "—"
      : `${delta_pct >= 0 ? "+" : ""}${delta_pct.toFixed(1)}%`;

  return (
    <div className="rounded-xl border border-court-border bg-court-surface p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-court-muted">
        <span>{label}</span>
        <span style={{ color }}>{deltaTxt}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-court-text">
          {hasData ? current!.toFixed(precision) : "—"}
        </span>
        <span className="text-sm text-court-muted">{unit}</span>
      </div>
      <SparkLine
        values={series ?? []}
        stroke={color}
        fill={fill}
        baseline={baseline ?? undefined}
      />
      <div className="text-[10px] text-court-muted">
        {baseline != null && Number.isFinite(baseline)
          ? `14-day avg: ${baseline.toFixed(precision)} ${unit}`
          : "gathering baseline…"}
      </div>
    </div>
  );
}
