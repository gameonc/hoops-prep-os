"use client";

import { useCallback, useEffect, useState } from "react";
import ReadinessDial from "@/components/ReadinessDial";
import PlanBlocks from "@/components/PlanBlocks";
import TrendCard from "@/components/TrendCard";
import WorkloadCard from "@/components/WorkloadCard";
import RecentWorkouts from "@/components/RecentWorkouts";
import NextGameCard from "@/components/NextGameCard";

type Trend = {
  current: number | null;
  baseline: number | null;
  delta_pct: number | null;
  series: number[];
};

type Dash = {
  athlete: { display_name: string; position: string; season_phase: string };
  today: string;
  today_plan: any | null;
  next_game: any | null;
  trends: {
    sleep_hours: Trend;
    resting_hr: Trend;
    hrv_ms: Trend;
    vo2_max: Trend;
  };
  workload: {
    acwr: number;
    sessions_7d: number;
    sessions_14d: number;
    minutes_7d: number;
    load_status: string;
  };
  recovery_series: any[];
  plans_series: any[];
  recent_workouts: any[];
};

export default function Dashboard() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/dashboard");
      if (r.status === 401) { setError("Sign in to see your dashboard."); return; }
      if (r.status === 400) { setError("Finish onboarding to see your dashboard."); return; }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      setDash(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const build = async () => {
    setBuilding(true); setError(null);
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_date: dash?.today }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuilding(false);
    }
  };

  if (loading && !dash) {
    return <main className="text-court-muted text-sm">Loading your dashboard…</main>;
  }

  if (error && !dash) {
    return (
      <main className="rounded-xl border border-court-border bg-court-surface p-6">
        <div className="text-court-bad text-sm">{error}</div>
      </main>
    );
  }

  if (!dash) return null;

  const plan = dash.today_plan;
  const score = plan?.readiness_score ?? 0;

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {dash.athlete.display_name} · {dash.today}
          </h1>
          <p className="text-court-muted text-sm mt-1">
            {dash.athlete.position} · {dash.athlete.season_phase} · your day tuned to today's readiness
          </p>
        </div>
        <button
          onClick={build}
          disabled={building}
          className="rounded-lg px-4 py-2 bg-court-accent text-black font-semibold disabled:opacity-50"
        >
          {building ? "Building…" : plan ? "Regenerate plan" : "Build today's plan"}
        </button>
      </div>

      {error && <div className="text-court-bad text-sm">{error}</div>}

      {/* Row 1 — Readiness + trends */}
      <section className="grid gap-4 md:grid-cols-[260px_1fr]">
        <ReadinessDial
          score={score}
          subtitle={plan ? "Today's readiness" : "No plan yet"}
        />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <TrendCard
            label="Sleep"
            unit="hrs"
            current={dash.trends.sleep_hours.current}
            baseline={dash.trends.sleep_hours.baseline}
            delta_pct={dash.trends.sleep_hours.delta_pct}
            series={dash.trends.sleep_hours.series}
            direction="higher_is_better"
            precision={1}
          />
          <TrendCard
            label="Resting HR"
            unit="bpm"
            current={dash.trends.resting_hr.current}
            baseline={dash.trends.resting_hr.baseline}
            delta_pct={dash.trends.resting_hr.delta_pct}
            series={dash.trends.resting_hr.series}
            direction="lower_is_better"
            precision={0}
          />
          <TrendCard
            label="HRV"
            unit="ms"
            current={dash.trends.hrv_ms.current}
            baseline={dash.trends.hrv_ms.baseline}
            delta_pct={dash.trends.hrv_ms.delta_pct}
            series={dash.trends.hrv_ms.series}
            direction="higher_is_better"
            precision={0}
          />
          <TrendCard
            label="VO₂ max"
            unit="ml/kg/min"
            current={dash.trends.vo2_max.current}
            baseline={dash.trends.vo2_max.baseline}
            delta_pct={dash.trends.vo2_max.delta_pct}
            series={dash.trends.vo2_max.series}
            direction="higher_is_better"
            precision={1}
          />
        </div>
      </section>

      {/* Row 2 — Workload + Next Game */}
      <section className="grid gap-4 md:grid-cols-2">
        <WorkloadCard workload={dash.workload} />
        <NextGameCard game={dash.next_game} />
      </section>

      {/* Row 3 — Today's plan */}
      {plan ? (
        <section className="rounded-xl border border-court-border bg-court-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-court-muted">Today's plan</div>
            <div className="text-xs text-court-muted">
              {plan.session_type} · intensity {plan.intensity}/10 · {plan.duration_min} min
              {plan.estimated_kcal ? ` · ~${plan.estimated_kcal} kcal` : ""}
            </div>
          </div>
          <PlanBlocks blocks={plan.blocks ?? []} />
          {plan.rationale && (
            <div className="text-sm text-court-muted italic border-l-2 border-court-border pl-3">
              {plan.rationale}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-court-border bg-court-surface p-5">
          <div className="text-court-muted text-sm">
            No plan yet. Hit <span className="text-court-text">Build today's plan</span> once you've logged sleep / soreness — or once your Apple Watch has synced today's recovery.
          </div>
        </section>
      )}

      {/* Row 4 — Recent workouts */}
      <section>
        <RecentWorkouts workouts={dash.recent_workouts} />
      </section>
    </main>
  );
}
