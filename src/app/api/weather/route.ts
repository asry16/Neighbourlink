import { NextResponse } from "next/server";
import type { CurrentWeather } from "@/lib/weather";

const CACHE_TTL_MS = 5 * 60 * 1000;
// Keyed by ~1 km grid cell so nearby walkers share one upstream request.
const cache = new Map<string, { at: number; data: CurrentWeather }>();

const FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "is_day",
].join(",");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ success: false, error: "Valid lat and lng are required" }, { status: 400 });
  }

  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, data: hit.data, cached: true });
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&current=${FIELDS}&timezone=auto`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Weather provider responded ${res.status}`);
    const json = await res.json();
    const c = json.current;

    const data: CurrentWeather = {
      latitude: json.latitude,
      longitude: json.longitude,
      observedAt: c.time,
      temperatureC: c.temperature_2m,
      feelsLikeC: c.apparent_temperature,
      humidityPct: c.relative_humidity_2m,
      precipitationMm: c.precipitation ?? 0,
      weatherCode: c.weather_code,
      cloudCoverPct: c.cloud_cover,
      windKmh: c.wind_speed_10m,
      windFromDeg: c.wind_direction_10m,
      isDay: c.is_day === 1,
      source: "Open-Meteo",
    };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json({ success: true, data, cached: false });
  } catch (error) {
    console.error("GET /api/weather failed:", error);
    // Serve stale data rather than nothing when the provider blips.
    if (hit) return NextResponse.json({ success: true, data: hit.data, cached: true, stale: true });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Weather unavailable" },
      { status: 502 }
    );
  }
}
