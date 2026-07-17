/**
 * Base fetcher for any RapidAPI-hosted service.
 * All wrappers below share this transport.
 */

const KEY = process.env.RAPIDAPI_KEY;

if (!KEY && process.env.NODE_ENV !== "test") {
  console.warn("[rapidapi] RAPIDAPI_KEY not set — client calls will 401.");
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export type RapidCall = {
  host: string;
  path: string;
  method?: Method;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  /** In-memory cache TTL in seconds. 0 disables. */
  cacheTtl?: number;
};

const memCache = new Map<string, { at: number; data: unknown }>();

export async function rapid<T>(c: RapidCall): Promise<T> {
  const q = c.query
    ? "?" +
      Object.entries(c.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";

  const url = `https://${c.host}${c.path}${q}`;
  const cacheKey = `${c.method ?? "GET"} ${url} ${JSON.stringify(c.body ?? "")}`;

  if (c.cacheTtl && memCache.has(cacheKey)) {
    const hit = memCache.get(cacheKey)!;
    if (Date.now() - hit.at < c.cacheTtl * 1000) return hit.data as T;
  }

  const res = await fetch(url, {
    method: c.method ?? "GET",
    headers: {
      "x-rapidapi-key": KEY ?? "",
      "x-rapidapi-host": c.host,
      "content-type": "application/json",
      ...(c.headers ?? {}),
    },
    body: c.body ? JSON.stringify(c.body) : undefined,
    // Next.js: don't cache on the framework layer — we cache in-memory above.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RapidAPI ${c.host}${c.path} → ${res.status} ${res.statusText}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as T;
  if (c.cacheTtl) memCache.set(cacheKey, { at: Date.now(), data });
  return data;
}
