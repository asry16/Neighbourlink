"use client";

import React, { useState } from "react";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { Badge, Card, humanize } from "@/components/ui/primitives";
import { RISK_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { RiskEvaluationOutput } from "@/services/risk-service";

export function FloodRiskSimulator() {
  const [selectedScenario, setSelectedScenario] = useState<string>("ELEVATED");
  const [evaluation, setEvaluation] = useState<RiskEvaluationOutput | null>({
    riskLevel: "ELEVATED",
    modelName: "Experimental Rule-Based Flood Engine v1.0",
    disclaimer:
      "Experimental rule-based flood-risk indicator — not an official warning.",
    horizonHours: 24,
    isStale: false,
    evaluatedAt: new Date(),
    explanation:
      "Elevated waterlogging risk: Moderate antecedent rainfall or significant forecast precipitation over vulnerable low-lying terrain. Sub-arterial roads may experience localized pooling during peak runoff.",
    contributingFactors: [
      "Recent 24h Rainfall: 62.4mm",
      "Forecast 24h Rainfall: 28mm",
      "Canal / River Gauge: 1.45m",
      "Historical Basin Susceptibility: Low-lying drainage catchment",
    ],
  });
  const [isLoading, setIsLoading] = useState(false);

  const scenarios: Record<
    string,
    {
      label: string;
      inputs: {
        rainfallRecentMm?: number | null;
        rainfallForecastMm?: number | null;
        waterLevelMeters?: number | null;
        historicalSusceptibility?: boolean;
        evaluatedAt?: string;
      };
    }
  > = {
    NORMAL: {
      label: "Dry weather",
      inputs: {
        rainfallRecentMm: 8.5,
        rainfallForecastMm: 5.0,
        waterLevelMeters: 0.6,
        historicalSusceptibility: false,
      },
    },
    ELEVATED: {
      label: "Monsoon shower",
      inputs: {
        rainfallRecentMm: 62.4,
        rainfallForecastMm: 28.0,
        waterLevelMeters: 1.45,
        historicalSusceptibility: true,
      },
    },
    HIGH: {
      label: "Tide surge + cloudburst",
      inputs: {
        rainfallRecentMm: 74.0,
        rainfallForecastMm: 35.5,
        waterLevelMeters: 2.1,
        historicalSusceptibility: true,
      },
    },
    MISSING_DATA: {
      label: "Missing forecast",
      inputs: {
        rainfallRecentMm: 45.0,
        rainfallForecastMm: null, // Missing forecast
        waterLevelMeters: 1.2,
      },
    },
    STALE_DATA: {
      label: "Stale feed",
      inputs: {
        rainfallRecentMm: 55.0,
        rainfallForecastMm: 30.0,
        waterLevelMeters: 1.8,
        evaluatedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      },
    },
  };

  const handleRunScenario = async (key: string) => {
    setSelectedScenario(key);
    setIsLoading(true);

    try {
      const res = await fetch("/api/risk/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenarios[key].inputs),
      });
      const data = await res.json();
      if (data.success) {
        setEvaluation(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const tone = RISK_TONE[evaluation?.riskLevel as keyof typeof RISK_TONE] ?? "neutral";

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-line">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15.5px] font-semibold text-ink">Try the risk engine</h3>
          {isLoading && <RefreshCw className="size-3.5 text-ink-subtle animate-spin" />}
        </div>
        <p className="mt-1 text-[13px] text-ink-subtle">
          Pick a scenario to see how inputs change the estimate — including how missing or stale
          data is handled.
        </p>
        <div className="mt-3 flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
          {Object.entries(scenarios).map(([key, s]) => {
            const active = selectedScenario === key;
            return (
              <button
                key={key}
                onClick={() => handleRunScenario(key)}
                aria-pressed={active}
                className={cn(
                  "h-8 px-3 rounded-full text-[12.5px] font-medium border whitespace-nowrap transition-colors",
                  active
                    ? "bg-ink text-canvas border-ink"
                    : "bg-surface text-ink-muted border-line hover:text-ink hover:border-line-strong"
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {evaluation && (
        <div
          className={cn(
            "grid md:grid-cols-[1fr_minmax(0,18rem)] transition-opacity",
            isLoading && "opacity-50"
          )}
        >
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone} className="h-7 px-2.5 text-[13px]">
                {evaluation.riskLevel === "INSUFFICIENT_DATA"
                  ? "Insufficient data"
                  : `${humanize(evaluation.riskLevel)} flood risk`}
              </Badge>
              {evaluation.isStale && (
                <Badge tone="warn" dot={false}>
                  <AlertTriangle className="size-3" /> Stale inputs (&gt;24h)
                </Badge>
              )}
              <span className="ml-auto font-mono text-[11.5px] text-ink-subtle">
                {evaluation.horizonHours}h horizon
              </span>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink">{evaluation.explanation}</p>
            <p className="mt-4 flex items-start gap-2 text-[12px] leading-snug text-ink-subtle">
              <Info className="size-3.5 shrink-0 mt-px" />
              {evaluation.disclaimer} Not calibrated as an ML model.
            </p>
          </div>

          <div className="p-5 bg-surface-2/60 border-t md:border-t-0 md:border-l border-line">
            <div className="nl-eyebrow">Contributing factors</div>
            <ul className="mt-3 flex flex-col gap-2.5">
              {evaluation.contributingFactors.map((factor, idx) => {
                const [k, v] = factor.split(/:\s(.+)/);
                return (
                  <li key={idx} className="text-[12.5px] leading-snug">
                    <span className="block text-ink-subtle">{v ? k : "Note"}</span>
                    <span className="block font-mono text-ink">{v ?? k}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
