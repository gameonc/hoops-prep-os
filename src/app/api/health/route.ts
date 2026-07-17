import { NextResponse } from "next/server";

/**
 * Lightweight health check for uptime monitors + Vercel edge dashboards.
 * Verifies:
 *   - the function boots
 *   - env is wired (booleans only; no values leaked)
 *
 * NOT authenticated on purpose. Rate limited by Vercel automatically.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  const env = {
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    rapidapi_key: !!process.env.RAPIDAPI_KEY,
    airquality_flavor: process.env.RAPIDAPI_AIRQUALITY_FLAVOR ?? "iqair-direct",
    iqair_key: !!process.env.IQAIR_KEY,
  };

  const missing = Object.entries(env)
    .filter(([k, v]) => typeof v === "boolean" && !v && k !== "iqair_key")
    .map(([k]) => k);

  const ok = missing.length === 0;

  return NextResponse.json(
    {
      ok,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      region: process.env.VERCEL_REGION ?? "local",
      env,
      missing,
      uptime_ms: Date.now() - startedAt,
      time: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    }
  );
}
