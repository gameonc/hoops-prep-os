import { NextRequest, NextResponse } from "next/server";
import { aiWorkout } from "@/lib/rapidapi/aiWorkout";

export const runtime = "nodejs";

/**
 * Exercise details lookup by name via AI Workout Planner /exerciseDetails.
 * Cached 24h in the shared rapid cache (see wrapper's cacheTtl). Useful when
 * the LLM plan surfaces an exercise name that isn't in ExerciseDB's catalog.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const exercise_name = decodeURIComponent(name);
  try {
    const detail = await aiWorkout.exerciseDetails(exercise_name);
    return NextResponse.json({ exercise: detail });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "lookup failed" }, { status: 502 });
  }
}
