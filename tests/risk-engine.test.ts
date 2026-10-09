import { describe, it, expect } from "vitest";
import { DeterministicFloodRiskEngine } from "@/services/risk-service";

describe("Deterministic Flood-Risk Heuristic Engine", () => {
  const engine = new DeterministicFloodRiskEngine();

  it("should output INSUFFICIENT_DATA when recent rainfall is missing", () => {
    const result = engine.evaluate({
      rainfallRecentMm: null,
      rainfallForecastMm: 25.0,
    });

    expect(result.riskLevel).toBe("INSUFFICIENT_DATA");
    expect(result.explanation).toContain("Insufficient meteorological precipitation data");
    expect(result.disclaimer).toContain("Experimental rule-based flood-risk indicator");
  });

  it("should output INSUFFICIENT_DATA when forecast rainfall is missing", () => {
    const result = engine.evaluate({
      rainfallRecentMm: 45.0,
      rainfallForecastMm: undefined,
    });

    expect(result.riskLevel).toBe("INSUFFICIENT_DATA");
    expect(result.contributingFactors).toContain("Missing 24h forecast precipitation input");
  });

  it("should output LOW risk under baseline dry conditions", () => {
    const result = engine.evaluate({
      rainfallRecentMm: 5.0,
      rainfallForecastMm: 4.0,
      waterLevelMeters: 0.5,
      historicalSusceptibility: false,
    });

    expect(result.riskLevel).toBe("LOW");
    expect(result.explanation).toContain("Normal baseline");
    expect(result.horizonHours).toBe(24);
  });

  it("should output ELEVATED risk when antecedent rain exceeds 30mm", () => {
    const result = engine.evaluate({
      rainfallRecentMm: 35.0,
      rainfallForecastMm: 10.0,
      historicalSusceptibility: false,
    });

    expect(result.riskLevel).toBe("ELEVATED");
    expect(result.explanation).toContain("Elevated waterlogging risk");
  });

  it("should output ELEVATED risk when forecast is heavy over historically susceptible terrain", () => {
    const result = engine.evaluate({
      rainfallRecentMm: 15.0,
      rainfallForecastMm: 32.0,
      historicalSusceptibility: true,
    });

    expect(result.riskLevel).toBe("ELEVATED");
  });

  it("should output HIGH risk upon severe rainfall convergence (>=50mm recent and >=25mm forecast)", () => {
    const result = engine.evaluate({
      rainfallRecentMm: 65.0,
      rainfallForecastMm: 30.0,
      waterLevelMeters: 1.8,
      historicalSusceptibility: true,
    });

    expect(result.riskLevel).toBe("HIGH");
    expect(result.explanation).toContain("Critical convergence");
  });

  it("should output HIGH risk when canal/river gauge exceeds 2.0m threshold", () => {
    const result = engine.evaluate({
      rainfallRecentMm: 20.0,
      rainfallForecastMm: 15.0,
      waterLevelMeters: 2.2,
    });

    expect(result.riskLevel).toBe("HIGH");
  });

  it("should detect and flag stale inputs (>24h old)", () => {
    const staleDate = new Date(Date.now() - 30 * 3600 * 1000);
    const result = engine.evaluate({
      rainfallRecentMm: 55.0,
      rainfallForecastMm: 30.0,
      evaluatedAt: staleDate,
    });

    expect(result.isStale).toBe(true);
  });
});
