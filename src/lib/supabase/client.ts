import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. During prerender/build the env vars may not be
 * present; we return a stub in that case so pages that call this at module load
 * don't crash the build. At runtime in the browser, env is inlined via Next.js.
 */
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Build-time / misconfigured — return a shape-compatible stub.
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ error: new Error("Supabase not configured") }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }) }) }),
        upsert: async () => ({ error: new Error("Supabase not configured") }),
        insert: async () => ({ error: new Error("Supabase not configured") }),
      }),
    } as any;
  }
  return createBrowserClient(url, key);
}
