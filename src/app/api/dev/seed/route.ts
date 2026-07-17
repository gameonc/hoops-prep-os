import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * DEV-ONLY sample data seeder.
 * Populates the last 14 days with realistic recovery + workout data so the
 * dashboard renders trends/sparklines before you wire up the phone.
 *
 * Guarded by NODE_ENV !== "production" — will 404 in production builds.
 *
 * POST /api/dev/seed  (must be signed in)
 */
export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: athlete } = await sb.from("athletes")
    .select("id,display_name,position").eq("user_id", user.id).single();
  if (!athlete) return NextResponse.json({ error: "no athlete profile — finish onboarding first" }, { status: 400 });

  // Realistic patterns: sleep varies 6.5–8.5, RHR 50–58, HRV 60–95,
  // VO2 hovers around 50, workouts alternate sport/strength/rest.
  const days = 14;
  const today = new Date();
  const rng = mulberry32(hashStr(athlete.id + "seed"));

  const recoveryRows: any[] = [];
  const workoutRows: any[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const dateISO = d.toISOString().slice(0, 10);
    const dow = d.getDay(); // 0 = Sun

    // Recovery
    const sleep = round(6.5 + rng() * 2.2, 1);
    const sleepQ = Math.round(3 + rng() * 2);
    const rhr = Math.round(50 + rng() * 8);
    const hrv = Math.round(60 + rng() * 35);
    const vo2 = round(49.5 + rng() * 2.5, 1);
    const deep = Math.round(60 + rng() * 40);
    const rem = Math.round(80 + rng() * 60);
    const core = Math.round(180 + rng() * 80);
    const soreness = Math.round(1 + rng() * 3);
    const stress = Math.round(1 + rng() * 3);

    recoveryRows.push({
      athlete_id: athlete.id,
      log_date: dateISO,
      sleep_hours: sleep,
      sleep_quality: sleepQ,
      resting_hr: rhr,
      hrv_ms: hrv,
      vo2_max: vo2,
      deep_sleep_min: deep,
      rem_sleep_min: rem,
      core_sleep_min: core,
      soreness,
      stress,
      source: "sample",
    });

    // Workouts — 5 days a week pattern
    const isRest = dow === 0 || (dow === 3 && rng() > 0.5);
    if (!isRest) {
      const isSport = [1, 4, 6].includes(dow);
      const sessionType = isSport ? "sport" : rng() > 0.6 ? "strength" : "cardio";
      const durMin = isSport ? 60 + Math.round(rng() * 30) : 40 + Math.round(rng() * 25);
      const avgHR = isSport ? 140 + Math.round(rng() * 20) : 118 + Math.round(rng() * 15);
      const maxHR = avgHR + 25 + Math.round(rng() * 15);
      const kcal = Math.round(durMin * (isSport ? 8 : 6));
      const rpe = isSport ? 6 + Math.round(rng() * 2) : 4 + Math.round(rng() * 2);
      const startAt = new Date(d);
      startAt.setHours(isSport ? 17 : 7, 0, 0, 0);
      const endAt = new Date(startAt.getTime() + durMin * 60_000);

      workoutRows.push({
        athlete_id: athlete.id,
        workout_date: dateISO,
        activity_name: isSport ? "Basketball" : sessionType === "strength" ? "Traditional Strength Training" : "Functional Strength Training",
        session_type: sessionType,
        duration_min: durMin,
        active_calories: kcal,
        avg_hr: avgHR,
        max_hr: maxHR,
        rpe,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        source: "sample",
        raw: { sampled: true },
      });
    }
  }

  // Upsert (ignore duplicates so re-seeding is idempotent per date)
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    sb.from("recovery_logs").upsert(recoveryRows, { onConflict: "athlete_id,log_date" }),
    sb.from("workouts").upsert(workoutRows, {
      onConflict: "athlete_id,workout_date,duration_min,activity_name,start_at",
      ignoreDuplicates: true,
    }),
  ]);

  // Add a demo game 4 days from now if none exists
  const in4 = new Date(today.getTime() + 4 * 86_400_000);
  in4.setHours(19, 30, 0, 0);
  const { data: existing } = await sb.from("games")
    .select("id").eq("athlete_id", athlete.id)
    .gte("tipoff_at", today.toISOString()).limit(1).maybeSingle();

  if (!existing) {
    await sb.from("games").insert({
      athlete_id: athlete.id,
      tipoff_at: in4.toISOString(),
      opponent: "Sample Rivals",
      home: true,
      importance: 3,
      travel_km: 0,
      notes: "seeded sample game",
    });
  }

  return NextResponse.json({
    ok: true,
    inserted: {
      recovery: recoveryRows.length,
      workouts: workoutRows.length,
      game: existing ? "already scheduled" : "added",
    },
    errors: [e1?.message, e2?.message].filter(Boolean),
  });
}

// --- deterministic PRNG so re-seeding same athlete produces same series ---
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function round(x: number, d: number) { const k = 10 ** d; return Math.round(x * k) / k; }
