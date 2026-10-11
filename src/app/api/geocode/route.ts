import { NextResponse } from "next/server";
import type { PlaceResult } from "@/lib/places";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: PlaceResult[] }>();

/** City / place search via Open-Meteo's free geocoder (no key). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  // Optional ISO-3166 alpha-2 filter, e.g. "IN" for places in India only.
  const country = /^[A-Za-z]{2}$/.test(params.get("country") ?? "") ? params.get("country")!.toUpperCase() : null;
  if (q.length < 2 || q.length > 80) {
    return NextResponse.json({ success: true, data: [] });
  }

  const key = `${country ?? "*"}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, data: hit.data });
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json${country ? `&countryCode=${country}` : ""}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
    const json = await res.json();
    const data: PlaceResult[] = (json.results ?? [])
      // Skip airports and the like; keep populated places and areas.
      .filter((r: { feature_code?: string }) => !r.feature_code || r.feature_code.startsWith("PP") || r.feature_code.startsWith("ADM"))
      .map((r: { id: number; name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
        id: r.id,
        name: r.name,
        region: r.admin1,
        country: r.country,
        latitude: r.latitude,
        longitude: r.longitude,
      }));
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
