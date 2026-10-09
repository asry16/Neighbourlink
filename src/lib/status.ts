import type { Tone } from "@/components/ui/primitives";
import type {
  DemoHazardUpdate,
  DemoIncident,
  DemoRiskEstimate,
  DemoSOS,
} from "@/lib/demo-data";

/** One place that decides how each domain status is coloured. */

export const INCIDENT_TONE: Record<DemoIncident["status"], Tone> = {
  UNVERIFIED: "warn",
  CORROBORATED: "accent",
  DISPUTED: "danger",
  RESOLVED: "ok",
};

export const HAZARD_TONE: Record<DemoHazardUpdate["severity"], Tone> = {
  ADVISORY: "warn",
  WARNING: "warn",
  CRITICAL: "danger",
};

export const RISK_TONE: Record<DemoRiskEstimate["riskLevel"], Tone> = {
  LOW: "ok",
  ELEVATED: "warn",
  HIGH: "danger",
  INSUFFICIENT_DATA: "neutral",
};

export const SOS_TONE: Record<DemoSOS["status"], Tone> = {
  REQUESTED: "danger",
  ACKNOWLEDGED: "accent",
  ASSISTANCE_REPORTED: "accent",
  RESOLVED: "ok",
};

export const SOS_CATEGORY_LABEL: Record<DemoSOS["category"], string> = {
  TRAPPED_FLOOD: "Stranded in flood water",
  MEDICAL: "Medical emergency",
  EVACUATION: "Evacuation needed",
  SUPPLIES: "Essential supplies",
};

export const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
