import { describe, it, expect } from "vitest";
import { weatherScene, skyFor, type CurrentWeather } from "@/lib/weather";

const base: CurrentWeather = {
  latitude: 22.57,
  longitude: 88.36,
  observedAt: "2026-10-11T13:45",
  temperatureC: 30,
  feelsLikeC: 33,
  humidityPct: 60,
  precipitationMm: 0,
  weatherCode: 0,
  cloudCoverPct: 0,
  windKmh: 10,
  windFromDeg: 180,
  isDay: true,
  source: "Open-Meteo",
};

describe("Weather scene model", () => {
  it("shows a clear sky with no precipitation for code 0", () => {
    const s = weatherScene(base);
    expect(s.precip).toBe("none");
    expect(s.cloudCover).toBe(0);
    expect(s.fog).toBe(0);
    expect(s.thunder).toBe(false);
  });

  it("maps WMO codes to the right precipitation kind", () => {
    expect(weatherScene({ ...base, weatherCode: 53 }).precip).toBe("drizzle");
    expect(weatherScene({ ...base, weatherCode: 65 }).precip).toBe("rain");
    expect(weatherScene({ ...base, weatherCode: 75 }).precip).toBe("snow");
    expect(weatherScene({ ...base, weatherCode: 99 }).precip).toBe("hail");
  });

  it("flags thunderstorms and fog", () => {
    expect(weatherScene({ ...base, weatherCode: 95 }).thunder).toBe(true);
    expect(weatherScene({ ...base, weatherCode: 45 }).fog).toBeGreaterThan(0.5);
  });

  it("shows measured precipitation even when the code is dry", () => {
    expect(weatherScene({ ...base, precipitationMm: 1 }).precip).toBe("rain");
    expect(weatherScene({ ...base, precipitationMm: 1, temperatureC: -1 }).precip).toBe("snow");
  });

  it("raises cloud cover for overcast and wet weather", () => {
    expect(weatherScene({ ...base, weatherCode: 3, cloudCoverPct: 40 }).cloudCover).toBeGreaterThanOrEqual(0.9);
    expect(weatherScene({ ...base, weatherCode: 63 }).cloudCover).toBeGreaterThanOrEqual(0.75);
  });

  it("darkens the sky at night and under storm cloud", () => {
    const day = skyFor(weatherScene(base))["sky-color"];
    const night = skyFor(weatherScene({ ...base, isDay: false }))["sky-color"];
    const storm = skyFor(weatherScene({ ...base, weatherCode: 95 }))["sky-color"];
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lum(night)).toBeLessThan(lum(day));
    expect(lum(storm)).toBeLessThan(lum(day));
  });
});
