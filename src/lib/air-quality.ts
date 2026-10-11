/**
 * India National Air Quality Index (CPCB method) from PM2.5 and PM10.
 * CPCB uses 24-hour averages; the overall AQI is the worst sub-index.
 */

export type NaqiCategory = "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe";

interface Band {
  lo: number;
  hi: number;
  aqiLo: number;
  aqiHi: number;
  category: NaqiCategory;
}

// Concentration breakpoints in µg/m³ (CPCB, 2014).
const PM25: Band[] = [
  { lo: 0, hi: 30, aqiLo: 0, aqiHi: 50, category: "Good" },
  { lo: 30, hi: 60, aqiLo: 50, aqiHi: 100, category: "Satisfactory" },
  { lo: 60, hi: 90, aqiLo: 100, aqiHi: 200, category: "Moderate" },
  { lo: 90, hi: 120, aqiLo: 200, aqiHi: 300, category: "Poor" },
  { lo: 120, hi: 250, aqiLo: 300, aqiHi: 400, category: "Very Poor" },
  { lo: 250, hi: 500, aqiLo: 400, aqiHi: 500, category: "Severe" },
];

const PM10: Band[] = [
  { lo: 0, hi: 50, aqiLo: 0, aqiHi: 50, category: "Good" },
  { lo: 50, hi: 100, aqiLo: 50, aqiHi: 100, category: "Satisfactory" },
  { lo: 100, hi: 250, aqiLo: 100, aqiHi: 200, category: "Moderate" },
  { lo: 250, hi: 350, aqiLo: 200, aqiHi: 300, category: "Poor" },
  { lo: 350, hi: 430, aqiLo: 300, aqiHi: 400, category: "Very Poor" },
  { lo: 430, hi: 1000, aqiLo: 400, aqiHi: 500, category: "Severe" },
];

function subIndex(value: number, bands: Band[]) {
  const v = Math.max(0, value);
  const band = bands.find((b) => v <= b.hi) ?? bands[bands.length - 1];
  const clamped = Math.min(v, band.hi);
  const aqi = band.aqiLo + ((clamped - band.lo) * (band.aqiHi - band.aqiLo)) / (band.hi - band.lo);
  return { aqi: Math.round(aqi), category: band.category };
}

export interface NaqiResult {
  aqi: number;
  category: NaqiCategory;
  /** Which pollutant set the index. */
  dominant: "PM2.5" | "PM10";
}

export function indiaNaqi(pm25: number, pm10: number): NaqiResult {
  const a = subIndex(pm25, PM25);
  const b = subIndex(pm10, PM10);
  return a.aqi >= b.aqi ? { ...a, dominant: "PM2.5" } : { ...b, dominant: "PM10" };
}

/** CPCB health advisory per category, shortened. */
export const NAQI_ADVICE: Record<NaqiCategory, string> = {
  Good: "Minimal impact.",
  Satisfactory: "Minor breathing discomfort for sensitive people.",
  Moderate: "Breathing discomfort for people with lung or heart conditions, children and older adults.",
  Poor: "Breathing discomfort for most people on prolonged exposure.",
  "Very Poor": "Respiratory illness on prolonged exposure. Limit time outdoors.",
  Severe: "Affects healthy people; serious for those with existing conditions. Avoid going outside.",
};

/** How thick the smog should look in walk mode, 0..1. */
export function smogLevel(category: NaqiCategory): number {
  return { Good: 0, Satisfactory: 0, Moderate: 0.15, Poor: 0.35, "Very Poor": 0.6, Severe: 0.85 }[category];
}

/** Tailwind classes for the CPCB colour band. */
export const NAQI_TONE: Record<NaqiCategory, string> = {
  Good: "bg-emerald-600 text-white",
  Satisfactory: "bg-lime-500 text-black",
  Moderate: "bg-yellow-400 text-black",
  Poor: "bg-orange-500 text-white",
  "Very Poor": "bg-red-600 text-white",
  Severe: "bg-red-900 text-white",
};

// ---------------------------------------------------------------------------
// US EPA AQI, used outside India.

export type UsAqiCategory =
  | "Good"
  | "Moderate"
  | "Unhealthy for Sensitive Groups"
  | "Unhealthy"
  | "Very Unhealthy"
  | "Hazardous";

export function usAqiCategory(aqi: number): UsAqiCategory {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

const US_ADVICE: Record<UsAqiCategory, string> = {
  Good: "Air quality is satisfactory.",
  Moderate: "Unusually sensitive people should limit prolonged exertion outdoors.",
  "Unhealthy for Sensitive Groups": "Children, older adults and people with lung or heart disease should reduce outdoor exertion.",
  Unhealthy: "Everyone should reduce prolonged exertion outdoors.",
  "Very Unhealthy": "Everyone should avoid prolonged exertion outdoors.",
  Hazardous: "Health warning of emergency conditions. Stay indoors.",
};

const US_TONE: Record<UsAqiCategory, string> = {
  Good: "bg-emerald-600 text-white",
  Moderate: "bg-yellow-400 text-black",
  "Unhealthy for Sensitive Groups": "bg-orange-500 text-white",
  Unhealthy: "bg-red-600 text-white",
  "Very Unhealthy": "bg-purple-700 text-white",
  Hazardous: "bg-red-950 text-white",
};

const US_SMOG: Record<UsAqiCategory, number> = {
  Good: 0,
  Moderate: 0,
  "Unhealthy for Sensitive Groups": 0.15,
  Unhealthy: 0.35,
  "Very Unhealthy": 0.6,
  Hazardous: 0.85,
};

export type AqiScale = "IN_NAQI" | "US_AQI";

export const AQI_SCALE_LABEL: Record<AqiScale, string> = {
  IN_NAQI: "India AQI (CPCB method)",
  US_AQI: "US AQI (EPA)",
};

/** Colour, advice and smog for a reading on either scale. */
export function aqiPresentation(scale: AqiScale, category: string) {
  if (scale === "IN_NAQI") {
    const c = category as NaqiCategory;
    return { tone: NAQI_TONE[c], advice: NAQI_ADVICE[c], smog: smogLevel(c) };
  }
  const c = category as UsAqiCategory;
  return { tone: US_TONE[c], advice: US_ADVICE[c], smog: US_SMOG[c] };
}
