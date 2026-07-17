import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { aiWorkout } from "@/lib/rapidapi/aiWorkout";
import { z } from "zod";

const Schema = z.object({ image_url: z.string().url() });

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: athlete } = await sb.from("athletes").select("id").eq("user_id", user.id).single();
  if (!athlete) return NextResponse.json({ error: "no athlete profile" }, { status: 400 });

  // Try live vision analysis; degrade to a "logged, no analysis" record if the
  // free tier / current model can't process the image. Verified 2026-07-17:
  // AI Workout Planner's /analyzeFoodPlate returns HTTP 400 on `image_url`
  // for the free tier. wrapper retries alternate field names and throws if all fail.
  let root: any = null;
  let analysisError: string | null = null;
  try {
    const analysis = await aiWorkout.analyzeFoodPlate(parsed.data.image_url);
    root = (analysis as any)?.result ?? analysis;
  } catch (e: any) {
    analysisError = e?.message ?? "analysis failed";
  }

  const t = root?.totals ?? root?.total ?? root?.macros ?? {};
  const items = root?.items ?? root?.foods ?? root?.result?.items ?? [];

  const { data, error } = await sb
    .from("meals")
    .insert({
      athlete_id: athlete.id,
      photo_url: parsed.data.image_url,
      kcal: Math.round(Number(t.kcal ?? t.calories ?? 0)),
      protein_g: Number(t.protein_g ?? t.protein ?? 0),
      carb_g: Number(t.carb_g ?? t.carbs ?? t.carbohydrates ?? 0),
      fat_g: Number(t.fat_g ?? t.fat ?? t.fats ?? 0),
      items,
      raw: root ?? { analysisError },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meal: data, analysisError });
}
