import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, resolveAthlete } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const Schema = z.object({
  log_date: z.string(),                              // YYYY-MM-DD
  sleep_hours: z.number().min(0).max(16).optional(),
  sleep_quality: z.number().int().min(1).max(10).optional(),
  soreness: z.number().int().min(1).max(10).optional(),
  stress: z.number().int().min(1).max(10).optional(),
  hrv_ms: z.number().optional(),
  resting_hr: z.number().int().optional(),
  mood: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { athlete, error: authErr } = await resolveAthlete(sb);
  if (authErr === "unauthorized") return NextResponse.json({ error: authErr }, { status: 401 });
  if (!athlete) return NextResponse.json({ error: authErr ?? "no athlete profile" }, { status: 400 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await sb
    .from("recovery_logs")
    .upsert({ athlete_id: athlete.id, ...parsed.data }, { onConflict: "athlete_id,log_date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}
