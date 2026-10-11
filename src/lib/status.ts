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

/** "just now", "25 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Older than this, an update is flagged as possibly out of date. */
export const STALE_AFTER_HOURS = 24;
export const isStale = (iso: string, now = Date.now()) =>
  now - new Date(iso).getTime() > STALE_AFTER_HOURS * 3600_000;
