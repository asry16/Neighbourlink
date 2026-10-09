import { prisma } from "@/lib/prisma";

export type RiskLevel = "LOW" | "ELEVATED" | "HIGH" | "INSUFFICIENT_DATA";

export interface RiskEvaluationInput {
  rainfallRecentMm?: number | null;
  rainfallForecastMm?: number | null;
  waterLevelMeters?: number | null;
  historicalSusceptibility?: boolean;
  evaluatedAt?: Date;
}

export interface RiskEvaluationOutput {
  riskLevel: RiskLevel;
  modelName: string;
  disclaimer: string;
  horizonHours: number;
  explanation: string;
  contributingFactors: string[];
  isStale: boolean;
  evaluatedAt: Date;
}

/**
 * Interface allowing future plug-in of ML evaluated models
 */
export interface IFloodRiskEstimator {
  evaluate(input: RiskEvaluationInput): RiskEvaluationOutput;
}

/**
 * Deterministic, transparent prototype rule engine v1.0
 */
export class DeterministicFloodRiskEngine implements IFloodRiskEstimator {
  evaluate(input: RiskEvaluationInput): RiskEvaluationOutput {
    const {
      rainfallRecentMm,
      rainfallForecastMm,
      waterLevelMeters,
      historicalSusceptibility = false,
      evaluatedAt = new Date(),
    } = input;

    const modelName = "Experimental Rule-Based Flood Engine v1.0";
    const disclaimer =
      "Experimental rule-based flood-risk indicator — not an official warning.";
    const horizonHours = 24;

    const isStale =
      new Date().getTime() - new Date(evaluatedAt).getTime() > 24 * 3600 * 1000;

    // RULE 1: Missing essential inputs -> INSUFFICIENT_DATA (never assume safe/low!)
    if (
      rainfallRecentMm === undefined ||
      rainfallRecentMm === null ||
      rainfallForecastMm === undefined ||
      rainfallForecastMm === null
    ) {
      return {
        riskLevel: "INSUFFICIENT_DATA",
        modelName,
        disclaimer,
        horizonHours,
        isStale,
        evaluatedAt,
        explanation:
          "Insufficient meteorological precipitation data. Both recent 24h rainfall and forecast rainfall are mandatory inputs. Risk cannot be reliably estimated without them.",
        contributingFactors: [
          rainfallRecentMm == null ? "Missing recent 24h rainfall input" : "Recent rainfall supplied",
          rainfallForecastMm == null ? "Missing 24h forecast precipitation input" : "Forecast precipitation supplied",
        ],
      };
    }

    const contributingFactors: string[] = [
      `Recent 24h Rainfall: ${rainfallRecentMm}mm`,
      `Forecast 24h Rainfall: ${rainfallForecastMm}mm`,
    ];

    if (waterLevelMeters != null) {
      contributingFactors.push(`Canal / River Gauge: ${waterLevelMeters}m`);
    }

    if (historicalSusceptibility) {
      contributingFactors.push("Historical Basin Susceptibility: Low-lying drainage catchment");
    }

    // RULE 2: High Risk Convergence
    // Recent rain >= 50mm AND forecast >= 25mm, OR water level gauge >= 2.0m
    if (
      (rainfallRecentMm >= 50 && rainfallForecastMm >= 25) ||
      (waterLevelMeters != null && waterLevelMeters >= 2.0)
    ) {
      return {
        riskLevel: "HIGH",
        modelName,
        disclaimer,
        horizonHours,
        isStale,
        evaluatedAt,
        explanation:
          "Critical convergence: High antecedent rainfall combined with heavy forecast precipitation exceeds local stormwater drainage discharge thresholds. High street waterlogging and basement inundation expected.",
        contributingFactors,
      };
    }

    // RULE 3: Elevated Risk
    // Recent rain >= 30mm OR (forecast >= 30mm with historical susceptibility)
    if (
      rainfallRecentMm >= 30 ||
      (rainfallForecastMm >= 30 && historicalSusceptibility) ||
      (waterLevelMeters != null && waterLevelMeters >= 1.4)
    ) {
      return {
        riskLevel: "ELEVATED",
        modelName,
        disclaimer,
        horizonHours,
        isStale,
        evaluatedAt,
        explanation:
          "Elevated waterlogging risk: Moderate antecedent rainfall or significant forecast precipitation over vulnerable low-lying terrain. Sub-arterial roads may experience localized pooling during peak runoff.",
        contributingFactors,
      };
    }

    // RULE 4: Low Risk
    return {
      riskLevel: "LOW",
      modelName,
      disclaimer,
      horizonHours,
      isStale,
      evaluatedAt,
      explanation:
        "Normal baseline: Recent precipitation and near-term forecasts are currently within standard municipal storm sewer pump handling capacity.",
      contributingFactors,
    };
  }
}

export class RiskService {
  private static engine = new DeterministicFloodRiskEngine();

  /**
   * Fetch all stored risk estimate records
   */
  static async getStoredEstimates() {
    return prisma.riskEstimate.findMany({
      orderBy: { evaluatedAt: "desc" },
    });
  }

  /**
   * Evaluate flood risk for arbitrary inputs
   */
  static evaluateInputs(input: RiskEvaluationInput): RiskEvaluationOutput {
    return this.engine.evaluate(input);
  }
}
