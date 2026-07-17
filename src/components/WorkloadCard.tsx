type Workload = {
  acwr: number;
  sessions_7d: number;
  sessions_14d: number;
  minutes_7d: number;
  load_status: string;
};

/**
 * ACWR (acute:chronic workload ratio) gauge with the sweet-spot band 0.8-1.3.
 * Values outside that band correlate with injury risk in sports-science literature.
 */
export default function WorkloadCard({ workload }: { workload: Workload }) {
  const acwr = workload.acwr ?? 0;
  const pct = Math.min(100, (acwr / 2) * 100); // scale 0-2 to 0-100

  const color =
    acwr <= 0.8 ? "#84cc16" :
    acwr <= 1.3 ? "#22c55e" :
    acwr <= 1.5 ? "#f59e0b" :
                  "#ef4444";

  return (
    <div className="rounded-xl border border-court-border bg-court-surface p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-court-muted">Training load</div>
        <div className="text-xs" style={{ color }}>{workload.load_status}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-semibold text-court-text">{acwr.toFixed(2)}</div>
        <div className="text-xs text-court-muted">acute:chronic ratio</div>
      </div>

      {/* Gauge */}
      <div className="relative h-2 bg-[#1f1f26] rounded-full overflow-hidden">
        {/* Sweet-spot band 0.8-1.3 → 40%-65% of the 0-2 axis */}
        <div className="absolute inset-y-0 bg-[rgba(34,197,94,0.20)]"
             style={{ left: "40%", width: "25%" }} />
        <div className="absolute inset-y-0 rounded-full transition-all"
             style={{ width: `${pct}%`, background: color }} />
        <div className="absolute inset-y-0 w-px bg-court-text/40" style={{ left: "50%" }} />
      </div>
      <div className="flex justify-between text-[10px] text-court-muted -mt-1">
        <span>0</span><span>1.0</span><span>2.0</span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="text-center">
          <div className="text-xl font-semibold">{workload.sessions_7d}</div>
          <div className="text-[10px] uppercase text-court-muted">sessions 7d</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold">{workload.minutes_7d}</div>
          <div className="text-[10px] uppercase text-court-muted">min 7d</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold">{workload.sessions_14d}</div>
          <div className="text-[10px] uppercase text-court-muted">sessions 14d</div>
        </div>
      </div>
    </div>
  );
}
