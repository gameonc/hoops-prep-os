import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, resolveAthlete } from "@/lib/supabase/server";
import { aiWorkout, toGoal } from "@/lib/rapidapi/aiWorkout";

export const runtime = "nodejs";

/**
 * LLM-authored micro-cycle from the AI Workout Planner API.
 *
 * The deterministic /api/plan route stays the source of truth (readiness → dose).
 * This endpoint returns a WEEK of coach-style programming aligned with the
 * athlete's current prescription — useful as a comparison view or when the
 * athlete wants written-out variation for their focus.
 *
 * Costs ONE AI Workout Planner request per call. On BASIC tier (25/mo), this
 * is meant to be cached and refreshed weekly, not on every dashboard load.
 */
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { athlete, error: authErr } = await resolveAthlete(sb);
  if (authErr === "unauthorized") return NextResponse.json({ error: authErr }, { status: 401 });
  if (!athlete) return NextResponse.json({ error: authErr ?? "no athlete profile" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const useCustom: boolean = body.use_custom !== false;

  // Anchor to today's deterministic plan so the LLM programming matches the dose.
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayPlan } = await sb
    .from("daily_plans")
    .select("session_type,duration_min,focus")
    .eq("athlete_id", athlete.id)
    .eq("plan_date", today)
    .maybeSingle();

  const sessionType = todayPlan?.session_type ?? "strength";
  const duration    = Math.max(30, Math.min(75, Number(todayPlan?.duration_min ?? 45)));
  const focus       = (todayPlan?.focus as string[]) ?? ["posterior chain","single-leg","core"];

  const level =
    athlete.season_phase === "playoffs"    ? "Advanced"
    : athlete.season_phase === "in-season" ? "Advanced"
    :                                        "Intermediate";

  const equipment = (athlete.equipment as string[] | null) ?? ["barbell","dumbbell","body weight"];

  // Convert planner focus (targets) into a target_muscles list.
  const target_muscles = focus.flatMap((f) => {
    switch (f) {
      case "posterior chain":  return ["glutes","hamstrings"];
      case "single-leg":       return ["glutes","quads","hamstrings"];
      case "single-leg power": return ["glutes","quads","hamstrings","calves"];
      case "plyo":             return ["glutes","quads","calves"];
      case "upper push":       return ["pectorals","delts","triceps"];
      case "upper pull":       return ["lats","upper back","biceps"];
      case "core":             return ["abs","spine"];
      case "rotational core":  return ["abs","spine","serratus anterior"];
      case "hip mobility":     return ["adductors","abductors","glutes"];
      case "shoulder health":  return ["delts","upper back"];
      case "landing mechanics":return ["quads","glutes","calves"];
      default:                 return [f];
    }
  });

  try {
    const plan = useCustom
      ? await aiWorkout.customPlan({
          goal: toGoal(sessionType),
          fitness_level: level,
          preferences: ["Weight training","Plyometrics"],
          health_conditions: (athlete.injuries as string[])?.length ? (athlete.injuries as string[]) : ["None"],
          schedule: { days_per_week: 3, session_duration: duration },
          plan_duration_weeks: 1,
          target_muscles: Array.from(new Set(target_muscles)),
          equipment,
          lang: "en",
        })
      : await aiWorkout.generatePlan({
          goal: toGoal(sessionType),
          fitness_level: level,
          preferences: ["Weight training"],
          health_conditions: (athlete.injuries as string[])?.length ? (athlete.injuries as string[]) : ["None"],
          schedule: { days_per_week: 3, session_duration: duration },
          plan_duration_weeks: 1,
          lang: "en",
        });

    return NextResponse.json({ plan, source: useCustom ? "customWorkoutPlan" : "generateWorkoutPlan" });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "coach plan generation failed" },
      { status: 502 }
    );
  }
}
