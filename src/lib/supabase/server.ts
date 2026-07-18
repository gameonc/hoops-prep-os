import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options: Record<string, unknown> }[]) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any));
          } catch { /* called from a Server Component — ignore */ }
        },
      },
    }
  );
}

/** Bypasses RLS. Use only in server routes that authorize themselves. */
export function supabaseService() {
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * DEMO MODE: fixed athlete ID everyone uses when NEXT_PUBLIC_DEMO_MODE=1.
 * Skips signup + RLS. Do NOT ship this to production with real users.
 */
export const DEMO_ATHLETE_ID = "00000000-0000-0000-0000-000000000001";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}

/**
 * Returns the athlete row for the current request.
 * In demo mode: always returns the fixed demo athlete.
 * In real mode: looks up by auth.uid().
 */
export async function resolveAthlete(sb: Awaited<ReturnType<typeof supabaseServer>>) {
  if (isDemoMode()) {
    const { data, error } = await sb.from("athletes").select("*").eq("id", DEMO_ATHLETE_ID).single();
    if (error || !data) return { athlete: null, user: null, error: "demo athlete row missing" };
    return { athlete: data, user: { id: data.user_id ?? "demo" }, error: null };
  }
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { athlete: null, user: null, error: "unauthorized" };
  const { data: athlete } = await sb.from("athletes").select("*").eq("user_id", user.id).single();
  if (!athlete) return { athlete: null, user, error: "no athlete profile" };
  return { athlete, user, error: null };
}
