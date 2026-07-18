import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, resolveAthlete } from "@/lib/supabase/server";
import { z } from "zod";

const Schema = z.object({
  tipoff_at: z.string(),
  opponent: z.string().max(120).optional(),
  home: z.boolean().optional().default(true),
  travel_km: z.number().nonnegative().optional().default(0),
  importance: z.number().int().min(1).max(5).optional().default(1),
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
    .from("games")
    .insert({ athlete_id: athlete.id, ...parsed.data })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ game: data });
}

export async function GET() {
  const sb = await supabaseServer();
  const { athlete, error: authErr } = await resolveAthlete(sb);
  if (authErr === "unauthorized") return NextResponse.json({ error: authErr }, { status: 401 });
  if (!athlete) return NextResponse.json({ games: [] });

  const { data: games } = await sb
    .from("games")
    .select("*")
    .eq("athlete_id", athlete.id)
    .gte("tipoff_at", new Date().toISOString())
    .order("tipoff_at", { ascending: true })
    .limit(10);

  return NextResponse.json({ games });
}
