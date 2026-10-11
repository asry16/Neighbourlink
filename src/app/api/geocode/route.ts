import { NextResponse } from "next/server";
import type { PlaceResult } from "@/lib/places";

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_RESULTS = 8;
const cache = new Map<string, { at: number; data: PlaceResult[] }>();

type RawPlace = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  feature_code?: string;
  latitude: number;
  longitude: number;
};

async function search(q: string, country: string | null): Promise<PlaceResult[]> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${MAX_RESULTS}` +
    `&language=en&format=json${country ? `&countryCode=${country}` : ""}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
  const json = await res.json();
  return ((json.results ?? []) as RawPlace[])
    // Skip airports and the like; keep populated places and areas.
    .filter((r) => !r.feature_code || r.feature_code.startsWith("PP") || r.feature_code.startsWith("ADM"))
    .map((r) => ({
      id: r.id,
      name: r.name,
      region: r.admin1,
      country: r.country,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
}

const countryParam = (v: string | null) => (v && /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : null);

/**
 * City / place search via Open-Meteo's free geocoder (no key).
 * `country=IN` limits results to one country; `prefer=IN` searches the whole
 * world but lists that country's matches first.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const country = countryParam(params.get("country"));
  const prefer = country ? null : countryParam(params.get("prefer"));
  if (q.length < 2 || q.length > 80) {
    return NextResponse.json({ success: true, data: [] });
  }

  const key = `${country ?? "*"}|${prefer ?? "*"}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, data: hit.data });
  }

  try {
    let data: PlaceResult[];
    if (prefer) {
      const [preferred, world] = await Promise.allSettled([search(q, prefer), search(q, null)]);
      if (preferred.status === "rejected" && world.status === "rejected") throw world.reason;
      const merged = [
        ...(preferred.status === "fulfilled" ? preferred.value : []),
        ...(world.status === "fulfilled" ? world.value : []),
      ];
      const seen = new Set<number>();
      data = merged.filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, MAX_RESULTS);
    } else {
      data = await search(q, country);
    }
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/geocode failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Place search unavailable" },
      { status: 502 }
    );
  }
}
