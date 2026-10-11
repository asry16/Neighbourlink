import {
  Map as MapIcon,
  TriangleAlert,
  MessagesSquare,
  Shield,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/context/demo-context";
import type { ListKind, Overlay } from "@/context/overlay-context";

export type NavCountKey = "hazards" | "reports" | "sos";

export interface NavItem {
  /** `map` closes overlays; the rest open a browsing drawer. */
  id: "map" | ListKind;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  countKey?: NavCountKey;
  tone?: "danger";
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: "map", label: "Map", shortLabel: "Map", icon: MapIcon },
  { id: "hazards", label: "Hazard updates", shortLabel: "Alerts", icon: TriangleAlert, countKey: "hazards" },
  { id: "reports", label: "Community reports", shortLabel: "Reports", icon: MessagesSquare, countKey: "reports" },
  { id: "help", label: "Help centres", shortLabel: "Help", icon: Building2 },
  { id: "responder", label: "SOS queue", shortLabel: "Queue", icon: Shield, countKey: "sos", tone: "danger", roles: ["RESPONDER", "ADMIN"] },
];

/** Which nav item is "current" for the open overlay (details → its list). */
export function activeNavId(overlay: Overlay | null): NavItem["id"] | null {
  if (!overlay) return "map";
  if (overlay.kind === "details") return overlay.from ?? null;
  if (overlay.kind === "hazards" || overlay.kind === "reports" || overlay.kind === "help" || overlay.kind === "responder")
    return overlay.kind;
  return null;
}
