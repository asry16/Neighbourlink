/** Current conditions for a point, normalised from Open-Meteo. */
export interface CurrentWeather {
  latitude: number;
  longitude: number;
  observedAt: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  /** Precipitation over the provider's last interval (15 min), in mm. */
  precipitationMm: number;
  weatherCode: number;
  cloudCoverPct: number;
  windKmh: number;
  /** Direction the wind blows FROM, degrees clockwise from north. */
  windFromDeg: number;
  isDay: boolean;
  source: "Open-Meteo";
}

/** WMO weather interpretation codes used by Open-Meteo. */
const WMO_LABEL: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

export function weatherLabel(code: number): string {
  return WMO_LABEL[code] ?? "Unknown conditions";
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function compassPoint(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// ---------------------------------------------------------------------------
// Scene model: what the weather should look like, derived from a reading.

export type PrecipKind = "none" | "drizzle" | "rain" | "snow" | "hail";

export interface WeatherScene {
  precip: PrecipKind;
  /** 0 (none) to 1 (heaviest). */
  precipIntensity: number;
  /** 0 clear to 1 fully overcast. */
  cloudCover: number;
  /** 0 none to 1 dense fog. */
  fog: number;
  isDay: boolean;
  thunder: boolean;
  windKmh: number;
  windFromDeg: number;
  /** Feels-like temperature high enough to show heat haze. */
  hot: boolean;
}

const DRIZZLE: Record<number, number> = { 51: 0.3, 53: 0.5, 55: 0.7, 56: 0.4, 57: 0.6 };
const RAIN: Record<number, number> = { 61: 0.35, 63: 0.6, 65: 0.9, 66: 0.5, 67: 0.8, 80: 0.45, 81: 0.7, 82: 1, 95: 0.85 };
const SNOW: Record<number, number> = { 71: 0.35, 73: 0.6, 75: 1, 77: 0.3, 85: 0.5, 86: 0.9 };
const HAIL: Record<number, number> = { 96: 0.75, 99: 1 };

export function weatherScene(w: CurrentWeather): WeatherScene {
  const code = w.weatherCode;
  let precip: PrecipKind = "none";
  let precipIntensity = 0;

  if (code in HAIL) [precip, precipIntensity] = ["hail", HAIL[code]];
  else if (code in SNOW) [precip, precipIntensity] = ["snow", SNOW[code]];
  else if (code in RAIN) [precip, precipIntensity] = ["rain", RAIN[code]];
  else if (code in DRIZZLE) [precip, precipIntensity] = ["drizzle", DRIZZLE[code]];

  // Measured precipitation with a dry code (a passing shower) still shows.
  if (precip === "none" && w.precipitationMm > 0) {
    precip = w.temperatureC <= 0 ? "snow" : "rain";
    precipIntensity = Math.min(0.25 + w.precipitationMm / 4, 1);
  }

  let cloudCover = Math.min(Math.max(w.cloudCoverPct / 100, 0), 1);
  if (code === 3) cloudCover = Math.max(cloudCover, 0.9);
  if (precip !== "none") cloudCover = Math.max(cloudCover, 0.75);

  return {
    precip,
    precipIntensity,
    cloudCover,
    fog: code === 45 || code === 48 ? 0.85 : 0,
    isDay: w.isDay,
    thunder: code >= 95,
    windKmh: w.windKmh,
    windFromDeg: w.windFromDeg,
    hot: w.feelsLikeC >= 38,
  };
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * Math.min(Math.max(t, 0), 1));
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/** Sky, horizon and ground-fog settings for the map in this weather. */
export function skyFor(s: WeatherScene) {
  const gloom = Math.max(s.cloudCover * 0.75, s.precip === "none" ? 0 : 0.6 + s.precipIntensity * 0.3);
  let sky = s.isDay ? mixHex("#5b9fdf", "#8a949f", gloom) : mixHex("#081226", "#151a22", gloom);
  let horizon = s.isDay ? mixHex("#d4e6f5", "#b3bac2", gloom) : mixHex("#1d2b47", "#252a33", gloom);
  if (s.thunder) {
    sky = mixHex(sky, "#2d3340", 0.6);
    horizon = mixHex(horizon, "#4a5160", 0.5);
  }
  const fogColor = s.fog > 0 ? (s.isDay ? "#cdd2d7" : "#3a4048") : horizon;
  return {
    "sky-color": sky,
    "horizon-color": horizon,
    "fog-color": fogColor,
    "fog-ground-blend": s.fog > 0 ? 0.15 : s.precip !== "none" ? 0.55 : 0.85,
    "horizon-fog-blend": s.fog > 0 ? 0.9 : 0.5,
    "sky-horizon-blend": 0.6,
    "atmosphere-blend": 0,
  };
}

/** Demo previews. Always labelled as previews in the UI, never as live data. */
export const WEATHER_PREVIEWS: Record<string, { label: string; weather: Partial<CurrentWeather> }> = {
  clear: { label: "Clear day", weather: { weatherCode: 0, cloudCoverPct: 5, precipitationMm: 0, isDay: true, windKmh: 8, temperatureC: 31, feelsLikeC: 34 } },
  night: { label: "Clear night", weather: { weatherCode: 0, cloudCoverPct: 10, precipitationMm: 0, isDay: false, windKmh: 6, temperatureC: 26, feelsLikeC: 28 } },
  heat: { label: "Heatwave", weather: { weatherCode: 1, cloudCoverPct: 10, precipitationMm: 0, isDay: true, windKmh: 6, temperatureC: 41, feelsLikeC: 47 } },
  overcast: { label: "Overcast", weather: { weatherCode: 3, cloudCoverPct: 100, precipitationMm: 0, isDay: true, windKmh: 12 } },
  smog: { label: "Severe smog (AQI)", weather: { weatherCode: 1, cloudCoverPct: 20, precipitationMm: 0, isDay: true, windKmh: 3, temperatureC: 16, feelsLikeC: 16 } },
  fog: { label: "Fog", weather: { weatherCode: 45, cloudCoverPct: 100, precipitationMm: 0, isDay: true, windKmh: 3, humidityPct: 98 } },
  windy: { label: "Strong wind", weather: { weatherCode: 2, cloudCoverPct: 45, precipitationMm: 0, isDay: true, windKmh: 55 } },
  drizzle: { label: "Drizzle", weather: { weatherCode: 53, cloudCoverPct: 90, precipitationMm: 0.3, isDay: true, windKmh: 10 } },
  rain: { label: "Heavy rain", weather: { weatherCode: 65, cloudCoverPct: 100, precipitationMm: 4, isDay: true, windKmh: 22 } },
  storm: { label: "Thunderstorm", weather: { weatherCode: 95, cloudCoverPct: 100, precipitationMm: 6, isDay: true, windKmh: 45 } },
  hail: { label: "Hailstorm", weather: { weatherCode: 99, cloudCoverPct: 100, precipitationMm: 5, isDay: true, windKmh: 40 } },
  snow: { label: "Snowfall", weather: { weatherCode: 73, cloudCoverPct: 100, precipitationMm: 1, isDay: true, windKmh: 12, temperatureC: -2, feelsLikeC: -6 } },
};
