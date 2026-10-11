"use client";

import React from "react";
import { LifeBuoy, Plus } from "lucide-react";
import { useOverlay } from "@/context/overlay-context";
import { NAV_ITEMS, activeNavId, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useNavCounts } from "./use-nav-counts";

const pick = (id: NavItem["id"]) => NAV_ITEMS.find((n) => n.id === id)!;

/** Mobile bottom navigation: Map · Alerts · Report · Reports · SOS. */
export function MobileNav() {
  const { overlay, open, close } = useOverlay();
  const counts = useNavCounts();
  const current = activeNavId(overlay);

  const renderItem = (n: NavItem) => {
    const active = current === n.id;
    return (
      <button
        key={n.id}
        onClick={() => void (n.id === "map" ? close() : open({ kind: n.id }))}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex-1 h-full flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
          active ? "text-ink" : "text-ink-subtle"
        )}
      >
        <n.icon className="size-5" strokeWidth={active ? 2 : 1.6} />
        {n.shortLabel}
        {active && <span className="absolute top-0 inset-x-6 h-0.5 rounded-b bg-accent" />}
      </button>
    );
  };

  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-line bg-surface flex items-stretch"
    >
      {renderItem(pick("map"))}
      {renderItem(pick("hazards"))}
      <div className="flex-1 grid place-items-center">
        <button
          onClick={() => void open({ kind: "report" })}
          aria-label="Report a hazard"
          className="size-12 -mt-6 rounded-2xl bg-ink text-canvas grid place-items-center shadow-[var(--shadow-float)] ring-4 ring-canvas active:scale-95 transition-transform"
        >
          <Plus className="size-5" strokeWidth={2.5} />
        </button>
      </div>
      {renderItem(pick("reports"))}
      <button
        onClick={() => void open({ kind: "sos" })}
        aria-label={counts.sos ? `Request help (SOS). ${counts.sos} open requests` : "Request help (SOS)"}
        className={cn(
          "flex-1 h-full flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-danger",
          overlay?.kind === "sos" && "bg-danger-soft"
        )}
      >
        <LifeBuoy className="size-5" />
        SOS
      </button>
    </nav>
  );
}
