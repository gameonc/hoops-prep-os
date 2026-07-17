/**
 * Compact inline sparkline for trend series. No dependencies.
 * Renders an SVG polyline scaled to width×height with an optional area fill.
 */
type Props = {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  /** Optional band — if `direction === "lower_is_better"`, deltas below baseline are good. */
  direction?: "higher_is_better" | "lower_is_better";
  baseline?: number | null;
};

export default function SparkLine({
  values,
  width = 160,
  height = 42,
  stroke = "#84cc16",
  fill = "rgba(132, 204, 22, 0.14)",
  strokeWidth = 2,
  baseline,
}: Props) {
  if (!values || values.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fill="#5c5c66" fontSize="10">
          need more data
        </text>
      </svg>
    );
  }

  const min = Math.min(...values, baseline ?? Infinity);
  const max = Math.max(...values, baseline ?? -Infinity);
  const range = max - min || 1;
  const pad = 3;

  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / range);

  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area =
    `M ${x(0)},${height - pad} ` +
    values.map((v, i) => `L ${x(i)},${y(v)}`).join(" ") +
    ` L ${x(values.length - 1)},${height - pad} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {baseline != null && Number.isFinite(baseline) && (
        <line
          x1={pad}
          x2={width - pad}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="#3f3f46"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <path d={area} fill={fill} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.5} fill={stroke} />
    </svg>
  );
}
