import {
  Map as MapIcon,
  TriangleAlert,
  MessagesSquare,
  LifeBuoy,
  Shield,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/context/demo-context";

/**
 * Every screen in the app. `map` renders the geospatial map; the feed tabs
 * render the list view scrolled to their section; the rest are full views.
 */
export type AppTab =
  | "map"
  | "hazards"
  | "reports"
  | "sos"
  | "shelters"
  | "responder"
  | "settings";

/** Tabs that render the feed (list view), mapped to their section anchor. */
export const FEED_SECTIONS: Partial<Record<AppTab, string>> = {
  hazards: "feed-hazards",
  reports: "feed-reports",
  sos: "feed-sos",
  shelters: "feed-shelters",
};

export const isFeedTab = (tab: AppTab) => tab in FEED_SECTIONS;

export type NavCountKey = "hazards" | "reports" | "sos";

export interface NavItem {
  id: AppTab;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  countKey?: NavCountKey;
  tone?: "danger";
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: "map", label: "Live map", shortLabel: "Map", icon: MapIcon },
  { id: "hazards", label: "Official alerts", shortLabel: "Alerts", icon: TriangleAlert, countKey: "hazards" },
  { id: "reports", label: "Community reports", shortLabel: "Reports", icon: MessagesSquare, countKey: "reports" },
  { id: "sos", label: "SOS queue", shortLabel: "SOS", icon: LifeBuoy, countKey: "sos", tone: "danger" },
  { id: "shelters", label: "Help centres", shortLabel: "Shelters", icon: Building2 },
  { id: "responder", label: "Responder station", shortLabel: "Station", icon: Shield, roles: ["RESPONDER", "ADMIN"] },
];
