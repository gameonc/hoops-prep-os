import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, resolveAthlete } from "@/lib/supabase/server";
import { buildDailyPlan, type AthleteCtx } from "@/lib/agent/planner";
import { differenceInHours } from "date-fns";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { athlete, error: authErr } = await resolveAthlete(sb);
  if (authErr === "unauthorized") return NextResponse.json({ error: authErr }, { status: 401 });
  if (!athlete) return NextResponse.json({ error: authErr ?? "no athlete profile" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const planDate = body.plan_date ? new Date(body.plan_date) : new Date();

  const dateISO = planDate.toISOString().slice(0, 10);

  const [{ data: rec }, { data: nextGame }] = await Promise.all([
    sb.from("recovery_logs").select("*").eq("athlete_id", athlete.id).eq("log_date", dateISO).maybeSingle(),
    sb.from("games")
      .select("*")
      .eq("athlete_id", athlete.id)
      .gte("tipoff_at", planDate.toISOString())
      .order("tipoff_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const ctx: AthleteCtx = {
    athlete_id: athlete.id,
    weight_kg: Number(athlete.weight_kg ?? 85),
    position: athlete.position ?? "U",
    equipment: (athlete.equipment as string[]) ?? ["barbell","dumbbell","body weight"],
    injuries: (athlete.injuries as string[]) ?? [],
    lat: athlete.lat != null ? Number(athlete.lat) : null,
    lon: athlete.lon != null ? Number(athlete.lon) : null,
    season_phase: athlete.season_phase ?? "offseason",
  };

  const plan = await buildDailyPlan({
    athlete: ctx,
    planDate,
    recovery: {
      sleep_hours:   rec?.sleep_hours    ?? null,
      sleep_quality: rec?.sleep_quality  ?? null,
      soreness:      rec?.soreness       ?? null,
      stress:        rec?.stress         ?? null,
      hrv_ms:        rec?.hrv_ms         ?? null,
      resting_hr:    rec?.resting_hr     ?? null,
      hrv_baseline_ms: null,
      rhr_baseline: null,
    },
    nextGameAt: nextGame ? new Date(nextGame.tipoff_at) : null,
    travelKmToday: nextGame?.travel_km ?? 0,
    tzShiftHours: 0,
  });

  // Persist (upsert on unique key)
  const { data: saved, error: sErr } = await sb
    .from("daily_plans")
    .upsert(
      {
        athlete_id: athlete.id,
        plan_date: plan.plan_date,
        readiness_score: plan.readiness_score,
        session_type: plan.session_type,
        intensity: plan.intensity,
        duration_min: plan.duration_min,
        focus: plan.focus,
        blocks: plan.blocks,
        rationale: plan.rationale,
        environment: plan.environment,
      },
      { onConflict: "athlete_id,plan_date" }
    )
    .select()
    .single();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  return NextResponse.json({ plan: { ...plan, id: saved.id } });
}

export async function GET(req: NextRequest) {
  const sb = await supabaseServer();
  const { athlete, error: authErr } = await resolveAthlete(sb);
  if (authErr === "unauthorized") return NextResponse.json({ error: authErr }, { status: 401 });
  if (!athlete) return NextResponse.json({ plan: null });
  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const { data: plan } = await sb
    .from("daily_plans")
    .select("*")
    .eq("athlete_id", athlete.id)
    .eq("plan_date", date)
    .maybeSingle();

  return NextResponse.json({ plan });
}
