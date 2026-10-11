import { describe, it, expect } from "vitest";
import { indiaNaqi, smogLevel, usAqiCategory, aqiPresentation } from "@/lib/air-quality";

describe("India National AQI (CPCB)", () => {
  it("rates clean air as Good", () => {
    expect(indiaNaqi(12, 30)).toMatchObject({ category: "Good" });
  });

  it("interpolates within a band", () => {
    // PM2.5 45 is halfway through 30–60 → AQI 75
    expect(indiaNaqi(45, 20).aqi).toBe(75);
  });

  it("takes the worse of the PM2.5 and PM10 sub-indices", () => {
    const r = indiaNaqi(20, 300); // PM10 300 → Poor (250)
    expect(r.category).toBe("Poor");
    expect(r.dominant).toBe("PM10");
    expect(r.aqi).toBe(250);
  });

  it("matches Delhi-style winter smog as Very Poor / Severe", () => {
    expect(indiaNaqi(180, 200).category).toBe("Very Poor");
    expect(indiaNaqi(320, 500).category).toBe("Severe");
  });

  it("caps at 500 for off-scale readings", () => {
    expect(indiaNaqi(900, 2000).aqi).toBe(500);
  });

  it("only shows smog from Moderate upward", () => {
    expect(smogLevel("Satisfactory")).toBe(0);
    expect(smogLevel("Poor")).toBeGreaterThan(0);
  });
});

describe("US AQI (outside India)", () => {
  it("uses EPA category boundaries", () => {
    expect(usAqiCategory(50)).toBe("Good");
    expect(usAqiCategory(51)).toBe("Moderate");
    expect(usAqiCategory(151)).toBe("Unhealthy");
    expect(usAqiCategory(350)).toBe("Hazardous");
  });

  it("presents either scale with a tone, advice and smog level", () => {
    expect(aqiPresentation("IN_NAQI", "Severe").smog).toBeGreaterThan(0.5);
    expect(aqiPresentation("US_AQI", "Good").smog).toBe(0);
    expect(aqiPresentation("US_AQI", "Unhealthy").tone).toContain("bg-");
  });
});
