import { NextRequest, NextResponse } from "next/server";

const HOST = process.env.RAPIDAPI_HOST_EXERCISEDB ?? "exercisedb.p.rapidapi.com";

/** Proxies ExerciseDB /image so we don't leak the RapidAPI key to the browser. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const resolution = req.nextUrl.searchParams.get("resolution") ?? "360";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const upstream = await fetch(`https://${HOST}/image?exerciseId=${encodeURIComponent(id)}&resolution=${resolution}`, {
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "",
      "x-rapidapi-host": HOST,
    },
  });
  if (!upstream.ok) return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/gif",
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
