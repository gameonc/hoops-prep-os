import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes Supabase auth cookies on every request so the session stays alive.
 * Skips static assets, image proxies, and the health check.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: Record<string, unknown> }[]) => {
        list.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options as any);
        });
      },
    },
  });

  // Touch auth to trigger cookie refresh if needed
  await supabase.auth.getUser().catch(() => null);

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static (static files)
     *  - _next/image (image optimization)
     *  - favicon, robots, sitemap
     *  - /api/health (public health check)
     *  - /api/exercise-image, /api/muscle-image (image proxies)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/health|api/exercise-image|api/muscle-image).*)",
  ],
};
