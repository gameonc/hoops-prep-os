import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, resolveAthlete } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Fetch the current athlete profile. Demo-mode aware. */
export async function GET() {
  const sb = await supabaseServer();
  const { athlete, error: authErr } = await resolveAthlete(sb);
  if (authErr === "unauthorized") return NextResponse.json({ error: authErr }, { status: 401 });
  if (!athlete) return NextResponse.json({ athlete: null });
  return NextResponse.json({ athlete });
}

/** Upsert the current athlete profile. Demo-mode aware. */
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { athlete: existing, error: authErr } = await resolveAthlete(sb);
  if (authErr === "unauthorized") return NextResponse.json({ error: authErr }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Whitelist the fields we allow updating
  const patch: any = {};
  for (const k of ["display_name","position","height_cm","weight_kg","training_age_years","city","country","lat","lon","season_phase","equipment","timezone"]) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  // Coerce numeric fields
  for (const k of ["height_cm","weight_kg","training_age_years","lat","lon"]) {
    if (patch[k] !== undefined && patch[k] !== null && patch[k] !== "") patch[k] = Number(patch[k]);
    if (patch[k] === "" || Number.isNaN(patch[k])) patch[k] = null;
  }

  if (!existing) {
    // Fresh insert (real-auth mode with no profile yet)
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb.from("athletes").insert({ ...patch, user_id: user?.id ?? null }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ athlete: data });
  }

  const { data, error } = await sb.from("athletes").update(patch).eq("id", existing.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ athlete: data });
}
