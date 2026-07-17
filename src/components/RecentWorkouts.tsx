type Workout = {
  id?: string;
  workout_date: string;
  activity_name: string;
  session_type: string;
  duration_min: number;
  active_calories?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  rpe?: number | null;
  start_at?: string | null;
  source?: string | null;
};

const TYPE_COLOR: Record<string, string> = {
  sport: "#84cc16",
  strength: "#22c55e",
  cardio: "#f59e0b",
  mobility: "#38bdf8",
  recovery: "#a78bfa",
  hiit: "#ef4444",
  yoga: "#a78bfa",
};

export default function RecentWorkouts({ workouts }: { workouts: Workout[] }) {
  if (!workouts || workouts.length === 0) {
    return (
      <div className="rounded-xl border border-court-border bg-court-surface p-5">
        <div className="text-xs uppercase tracking-wider text-court-muted mb-2">Recent workouts</div>
        <div className="text-sm text-court-muted">
          No workouts yet. Once your Apple Watch syncs a session, it shows up here.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-court-border bg-court-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-court-muted">Recent workouts</div>
        <div className="text-[10px] text-court-muted">from Apple Watch</div>
      </div>
      <ul className="divide-y divide-court-border">
        {workouts.map((w, i) => (
          <li key={w.id ?? `${w.workout_date}-${i}`}
              className="flex items-center gap-3 py-2.5 text-sm">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: TYPE_COLOR[w.session_type] ?? "#71717a" }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-court-text truncate">{w.activity_name}</div>
              <div className="text-[11px] text-court-muted">
                {w.workout_date} · {w.session_type}
              </div>
            </div>
            <div className="text-right text-court-muted text-xs">
              <div className="text-court-text">{w.duration_min} min</div>
              <div>
                {w.avg_hr ? `${w.avg_hr} bpm` : "—"}
                {w.rpe ? ` · RPE ${w.rpe}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
