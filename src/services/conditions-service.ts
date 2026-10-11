import { indiaNaqi } from "@/lib/air-quality";
import type { AirQualityReading, LiveFloodRisk, LocalConditions } from "@/lib/live-types";
import { RiskService } from "./risk-service";

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: LocalConditions }>();
/** Below this, a GloFAS cell is a minor channel and its ratio is noise. */
const MIN_MEANINGFUL_DISCHARGE_M3S = 5;

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** CAMS model PM2.5 / PM10 via Open-Meteo, scored on India's NAQI. */
async function airQuality(lat: number, lng: number): Promise<AirQualityReading> {
  const json = await fetchJson(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
      "&current=pm2_5,pm10&hourly=pm2_5,pm10&past_hours=24&forecast_hours=1&timezone=auto"
  );
  const pm25Avg = mean(json.hourly.pm2_5.slice(0, 24)) ?? json.current.pm2_5;
  const pm10Avg = mean(json.hourly.pm10.slice(0, 24)) ?? json.current.pm10;
  const naqi = indiaNaqi(pm25Avg, pm10Avg);
  return {
    ...naqi,
    pm25: json.current.pm2_5,
    pm10: json.current.pm10,
    pm25Avg24h: Math.round(pm25Avg),
    pm10Avg24h: Math.round(pm10Avg),
    observedAt: json.current.time,
  };
}

/** Rainfall (past / next 24 h) and GloFAS river flow fed into the risk engine. */
async function floodRisk(lat: number, lng: number): Promise<LiveFloodRisk> {
  const [rain, river] = await Promise.allSettled([
    fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        "&hourly=precipitation&past_hours=24&forecast_hours=24&timezone=auto"
    ),
    fetchJson(
      `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}` +
        "&daily=river_discharge,river_discharge_median&forecast_days=3"
    ),
  ]);

  let past: number | null = null;
  let next: number | null = null;
  if (rain.status === "fulfilled") {
    const h: (number | null)[] = rain.value.hourly?.precipitation ?? [];
    if (h.length >= 48) {
      past = Math.round(h.slice(0, 24).reduce<number>((a, b) => a + (b ?? 0), 0) * 10) / 10;
      next = Math.round(h.slice(24, 48).reduce<number>((a, b) => a + (b ?? 0), 0) * 10) / 10;
    }
  }

  let ratio: number | null = null;
  if (river.status === "fulfilled") {
    const d = river.value.daily;
    // Peak of the next three days against its seasonal median.
    const pairs = (d?.river_discharge ?? []).map((q: number | null, i: number) => [q, d.river_discharge_median?.[i]]);
    const usable = pairs.filter(
      ([q, m]: (number | null)[]) => q != null && m != null && m >= MIN_MEANINGFUL_DISCHARGE_M3S
    );
    if (usable.length) ratio = Math.round(Math.max(...usable.map(([q, m]: number[]) => q / m)) * 10) / 10;
  }

  const out = RiskService.evaluateInputs({
    rainfallRecentMm: past,
    rainfallForecastMm: next,
    riverDischargeRatio: ratio,
  });
  return {
    riskLevel: out.riskLevel,
    explanation: out.explanation,
    contributingFactors: out.contributingFactors,
    disclaimer: out.disclaimer,
    rainfallPast24hMm: past,
    rainfallNext24hMm: next,
    riverDischargeRatio: ratio,
  };
}

export class ConditionsService {
  /** Air quality and live flood risk for any point; each part fails independently. */
  static async forPoint(lat: number, lng: number): Promise<LocalConditions> {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

    const [aq, flood] = await Promise.allSettled([airQuality(lat, lng), floodRisk(lat, lng)]);
    if (aq.status === "rejected") console.error("Air quality failed:", aq.reason);
    if (flood.status === "rejected") console.error("Flood risk failed:", flood.reason);

    const data: LocalConditions = {
      latitude: lat,
      longitude: lng,
      airQuality: aq.status === "fulfilled" ? aq.value : null,
      floodRisk: flood.status === "fulfilled" ? flood.value : null,
      fetchedAt: new Date().toISOString(),
    };
    if (data.airQuality || data.floodRisk) cache.set(key, { at: Date.now(), data });
    return data;
  }
}
