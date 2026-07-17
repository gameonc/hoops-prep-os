type Game = {
  tipoff_at: string;
  opponent: string;
  home: boolean;
  importance?: number | null;
  travel_km?: number | null;
  hours_until: number | null;
};

export default function NextGameCard({ game }: { game: Game | null }) {
  if (!game) {
    return (
      <div className="rounded-xl border border-court-border bg-court-surface p-5">
        <div className="text-xs uppercase tracking-wider text-court-muted mb-2">Next game</div>
        <div className="text-sm text-court-muted">No game on the schedule yet.</div>
      </div>
    );
  }

  const h = game.hours_until ?? 0;
  const days = Math.floor(h / 24);
  const hrs = h % 24;

  const tapPhase =
    h <= 24 ? { label: "GAME DAY", color: "#ef4444" } :
    h <= 48 ? { label: "SHOOTAROUND WINDOW", color: "#f59e0b" } :
    h <= 72 ? { label: "LIGHT DAY -2", color: "#f59e0b" } :
    h <= 96 ? { label: "MODERATE -3", color: "#84cc16" } :
              { label: "BUILD PHASE", color: "#22c55e" };

  return (
    <div className="rounded-xl border border-court-border bg-court-surface p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-court-muted">Next game</div>
        <div className="text-[10px]" style={{ color: tapPhase.color }}>{tapPhase.label}</div>
      </div>
      <div className="text-xl font-semibold text-court-text">
        {game.home ? "vs" : "@"} {game.opponent}
      </div>
      <div className="text-sm text-court-muted">
        {new Date(game.tipoff_at).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 pt-2">
        <div className="text-center">
          <div className="text-lg font-semibold">{days}d {hrs}h</div>
          <div className="text-[10px] uppercase text-court-muted">until tipoff</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{game.importance ?? "—"}</div>
          <div className="text-[10px] uppercase text-court-muted">importance</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{game.travel_km ?? 0}</div>
          <div className="text-[10px] uppercase text-court-muted">km travel</div>
        </div>
      </div>
    </div>
  );
}
