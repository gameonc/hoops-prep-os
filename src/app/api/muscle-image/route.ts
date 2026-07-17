import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for the muscle image generator.
 * Tries V3 (/v2/images/single) first; falls back to legacy (/getImage) if V3 404s.
 */
const HOST = process.env.RAPIDAPI_HOST_MUSCLE_IMAGE ?? "muscle-group-image-generator.p.rapidapi.com";

export async function GET(req: NextRequest) {
  const muscles = req.nextUrl.searchParams.get("muscles") ?? "";
  const color = req.nextUrl.searchParams.get("color") ?? "#FF6B35";
  const transparent = req.nextUrl.searchParams.get("transparent") ?? "false";

  const headers = {
    "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "",
    "x-rapidapi-host": HOST,
  };

  const v2 = `https://${HOST}/v2/images/single?muscles=${encodeURIComponent(muscles)}&color=${encodeURIComponent(color)}&transparent=${transparent}`;
  let upstream = await fetch(v2, { headers });

  if (upstream.status === 404) {
    // Fall back to legacy v1 shape
    const legacyColor = color.replace(/^#/, "");
    const v1 = `https://${HOST}/getImage?muscleGroups=${encodeURIComponent(muscles)}&color=${legacyColor}&transparentBackground=${transparent === "true" ? 1 : 0}`;
    upstream = await fetch(v1, { headers });
  }

  if (!upstream.ok) return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/png",
      "cache-control": "public, max-age=3600",
    },
  });
}
