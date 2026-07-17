import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Dashboard aggregate: 14-day rolling window of recovery, workouts, plans + next game.
 * Returns everything the UI needs in one round-trip so we don't waterfall.
 */
export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: athlete } = await sb.from("athletes").select("*").eq("user_id", user.id).single();
  if (!athlete) return NextResponse.json({ error: "no athlete profile" }, { status: 400 });

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const from14 = new Date(today.getTime() - 13 * 86_400_000).toISOString().slice(0, 10);

  const [
    { data: recovery },
    { data: workouts },
    { data: plans },
    { data: todayPlan },
    { data: nextGame },
  ] = await Promise.all([
    sb.from("recovery_logs")
      .select("log_date,sleep_hours,sleep_quality,soreness,stress,hrv_ms,resting_hr,vo2_max,deep_sleep_min,rem_sleep_min,core_sleep_min,source")
      .eq("athlete_id", athlete.id)
      .gte("log_date", from14)
      .order("log_date", { ascending: true }),
    sb.from("workouts")
      .select("id,workout_date,activity_name,session_type,duration_min,active_calories,avg_hr,max_hr,rpe,start_at,source")
      .eq("athlete_id", athlete.id)
      .gte("workout_date", from14)
      .order("start_at", { ascending: false }),
    sb.from("daily_plans")
      .select("plan_date,readiness_score,session_type,intensity,duration_min")
      .eq("athlete_id", athlete.id)
      .gte("plan_date", from14)
      .order("plan_date", { ascending: true }),
    sb.from("daily_plans")
      .select("*")
      .eq("athlete_id", athlete.id)
      .eq("plan_date", todayISO)
      .maybeSingle(),
    sb.from("games")
      .select("tipoff_at,opponent,home,importance,travel_km")
      .eq("athlete_id", athlete.id)
      .gte("tipoff_at", today.toISOString())
      .order("tipoff_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const rec = recovery ?? [];
  const wo = workouts ?? [];

  // ---------- Trends ----------
  const nums = <T,>(arr: T[], key: keyof T) =>
    arr.map((r) => Number((r as any)[key])).filter((n) => Number.isFinite(n) && n > 0);

  const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  const sleepHrs = nums(rec, "sleep_hours");
  const rhr = nums(rec, "resting_hr");
  const hrv = nums(rec, "hrv_ms");
  const vo2 = nums(rec, "vo2_max");

  // Baseline = last 14d mean; current = latest reading; delta = pct vs baseline
  const trend = (arr: number[]) => {
    if (arr.length === 0) return { current: null, baseline: null, delta_pct: null, series: [] };
    const current = arr[arr.length - 1];
    const baseline = mean(arr) ?? current;
    const delta_pct = baseline > 0 ? ((current - baseline) / baseline) * 100 : 0;
    return { current, baseline, delta_pct, series: arr };
  };

  // ---------- ACWR (acute:chronic workload ratio) ----------
  // acute = 7d avg duration, chronic = 14d avg (proxy — literature uses 28d)
  const cutoff7 = new Date(today.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
  const last7 = wo.filter((w) => w.workout_date >= cutoff7);
  const acute = mean(last7.map((w) => Number(w.duration_min) || 0)) ?? 0;
  const chronic = mean(wo.map((w) => Number(w.duration_min) || 0)) ?? 0;
  const acwr = chronic > 0 ? acute / chronic : 1;

  // ---------- Load status ----------
  let load_status: string;
  if (wo.length < 6) load_status = "BASELINE — building your profile";
  else if (acwr <= 0.8) load_status = "FRESH — you can push harder";
  else if (acwr <= 1.0) load_status = "GOOD — ready to go";
  else if (acwr <= 1.3) load_status = "BUILDING — stay consistent";
  else if (acwr <= 1.5) load_status = "HEAVY — ease up soon";
  else load_status = "OVERLOADED — back off, injury risk";

  // ---------- Time to next game (hours) ----------
  const hoursToGame = nextGame?.tipoff_at
    ? Math.round((new Date(nextGame.tipoff_at).getTime() - today.getTime()) / 3_600_000)
    : null;

  return NextResponse.json({
    athlete: {
      display_name: athlete.display_name,
      position: athlete.position,
      season_phase: athlete.season_phase,
    },
    today: todayISO,
    today_plan: todayPlan ?? null,
    next_game: nextGame ? { ...nextGame, hours_until: hoursToGame } : null,
    trends: {
      sleep_hours: trend(sleepHrs),
      resting_hr: trend(rhr),
      hrv_ms: trend(hrv),
      vo2_max: trend(vo2),
    },
    workload: {
      acwr: Math.round(acwr * 100) / 100,
      sessions_7d: last7.length,
      sessions_14d: wo.length,
      minutes_7d: Math.round(last7.reduce((s, w) => s + (Number(w.duration_min) || 0), 0)),
      load_status,
    },
    recovery_series: rec.map((r) => ({
      date: r.log_date,
      sleep_hours: r.sleep_hours,
      resting_hr: r.resting_hr,
      hrv_ms: r.hrv_ms,
      source: r.source,
    })),
    plans_series: (plans ?? []).map((p) => ({
      date: p.plan_date,
      readiness: p.readiness_score,
      session_type: p.session_type,
      intensity: p.intensity,
      duration_min: p.duration_min,
    })),
    recent_workouts: wo.slice(0, 8),
  });
}
