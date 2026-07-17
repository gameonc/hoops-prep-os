import { NextRequest, NextResponse } from "next/server";
import { parseHAE, type HAEPayload } from "@/lib/wearables/parser";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Health Auto Export webhook receiver.
 *
 * Configure the Health Auto Export iOS app to POST to:
 *   https://<your-vercel-domain>/api/wearables/webhook?athlete=<athlete_id>
 *   Header: X-OPENCLAW-TOKEN: <WEARABLES_WEBHOOK_TOKEN env var>
 *
 * Because this is called by the phone (no Supabase session), we authenticate:
 *   1. Bearer token in X-OPENCLAW-TOKEN header
 *   2. Athlete ID in ?athlete=<uuid> query param
 * The route uses the service role key to bypass RLS for the insert.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-openclaw-token") ?? req.headers.get("x-hoops-token") ?? "";
  const expected = process.env.WEARABLES_WEBHOOK_TOKEN ?? "";
  if (!expected) {
    return NextResponse.json({ error: "server missing WEARABLES_WEBHOOK_TOKEN" }, { status: 500 });
  }
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const athleteId = url.searchParams.get("athlete");
  if (!athleteId) {
    return NextResponse.json({ error: "missing ?athlete=<uuid>" }, { status: 400 });
  }

  let payload: HAEPayload;
  try {
    payload = await req.json();
  } catch (e: any) {
    return NextResponse.json({ error: `bad JSON: ${e?.message ?? e}` }, { status: 400 });
  }

  const parsed = parseHAE(payload);

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supaSvc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supaUrl || !supaSvc) {
    return NextResponse.json(
      { error: "server missing SUPABASE_SERVICE_ROLE_KEY", parsed },
      { status: 500 }
    );
  }
  const sb = createClient(supaUrl, supaSvc, { auth: { persistSession: false } });

  // --- Workouts (dedup by unique key on athlete_id/date/duration/name/start_at) ---
  const workoutRows = parsed.workouts.map((w) => ({
    athlete_id: athleteId,
    workout_date: w.workout_date,
    activity_name: w.activity_name,
    session_type: w.session_type,
    duration_min: w.duration_min,
    active_calories: w.active_calories,
    avg_hr: w.avg_hr,
    max_hr: w.max_hr,
    rpe: w.rpe,
    start_at: w.start_at,
    end_at: w.end_at,
    source: "apple_watch",
    raw: w.raw,
  }));
  let workoutsInserted = 0;
  if (workoutRows.length > 0) {
    const { error, count } = await sb
      .from("workouts")
      .upsert(workoutRows, {
        onConflict: "athlete_id,workout_date,duration_min,activity_name,start_at",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (error) parsed.errors.push(`workouts insert: ${error.message}`);
    else workoutsInserted = count ?? workoutRows.length;
  }

  // --- Recovery (sleep + resting HR + VO2 merge into one row per athlete/date) ---
  const recByDate = new Map<string, any>();
  for (const s of parsed.sleep) {
    recByDate.set(s.log_date, {
      ...(recByDate.get(s.log_date) ?? {}),
      athlete_id: athleteId,
      log_date: s.log_date,
      sleep_hours: s.sleep_hours,
      sleep_quality: s.sleep_quality,
      deep_sleep_min: s.deep_sleep_min,
      rem_sleep_min: s.rem_sleep_min,
      core_sleep_min: s.core_sleep_min,
      source: "apple_watch",
    });
  }
  for (const h of parsed.resting_hr) {
    recByDate.set(h.log_date, {
      ...(recByDate.get(h.log_date) ?? { athlete_id: athleteId, log_date: h.log_date, source: "apple_watch" }),
      resting_hr: h.resting_hr,
    });
  }
  for (const v of parsed.vo2_max) {
    recByDate.set(v.log_date, {
      ...(recByDate.get(v.log_date) ?? { athlete_id: athleteId, log_date: v.log_date, source: "apple_watch" }),
      vo2_max: v.vo2_max,
    });
  }
  const recoveryRows = Array.from(recByDate.values());
  let recoveryUpserted = 0;
  if (recoveryRows.length > 0) {
    const { error, count } = await sb
      .from("recovery_logs")
      .upsert(recoveryRows, {
        onConflict: "athlete_id,log_date",
        count: "exact",
      });
    if (error) parsed.errors.push(`recovery upsert: ${error.message}`);
    else recoveryUpserted = count ?? recoveryRows.length;
  }

  return NextResponse.json({
    ok: true,
    processed: {
      workouts: workoutsInserted,
      recovery_days: recoveryUpserted,
      sleep_entries: parsed.sleep.length,
      resting_hr_entries: parsed.resting_hr.length,
      vo2_entries: parsed.vo2_max.length,
    },
    errors: parsed.errors,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST Health Auto Export JSON to this URL with X-OPENCLAW-TOKEN header and ?athlete=<uuid>",
  });
}
