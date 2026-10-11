import type { NaqiCategory } from "./air-quality";

export type LiveHazardType = "EARTHQUAKE" | "CYCLONE" | "FLOOD" | "DROUGHT" | "WILDFIRE" | "VOLCANO" | "OTHER";
export type AlertLevel = "GREEN" | "ORANGE" | "RED";

/** A real event from a public disaster feed. */
export interface LiveHazard {
  id: string;
  source: "USGS" | "GDACS";
  type: LiveHazardType;
  title: string;
  detail: string;
  alertLevel: AlertLevel | null;
  magnitude?: number;
  latitude: number;
  longitude: number;
  startedAt: string;
  endedAt: string | null;
  /** Still ongoing (GDACS) or within the last 24 h (earthquakes). */
  isCurrent: boolean;
  url: string;
}

export interface FeedStatus {
  name: "USGS" | "GDACS";
  ok: boolean;
  count: number;
  error?: string;
}

export interface LiveHazardsResponse {
  hazards: LiveHazard[];
  sources: FeedStatus[];
  fetchedAt: string;
}

export interface AirQualityReading {
  aqi: number;
  category: NaqiCategory;
  dominant: "PM2.5" | "PM10";
  pm25: number;
  pm10: number;
  /** 24-hour means used for the CPCB index. */
  pm25Avg24h: number;
  pm10Avg24h: number;
  observedAt: string;
}

export interface LiveFloodRisk {
  riskLevel: "LOW" | "ELEVATED" | "HIGH" | "INSUFFICIENT_DATA";
  explanation: string;
  contributingFactors: string[];
  disclaimer: string;
  rainfallPast24hMm: number | null;
  rainfallNext24hMm: number | null;
  riverDischargeRatio: number | null;
}

export interface LocalConditions {
  latitude: number;
  longitude: number;
  airQuality: AirQualityReading | null;
  floodRisk: LiveFloodRisk | null;
  fetchedAt: string;
}
