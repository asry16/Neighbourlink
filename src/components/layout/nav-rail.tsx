"use client";

import React from "react";
import { Plus, LifeBuoy, Settings2 } from "lucide-react";
import { useDemo } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";
import { NAV_ITEMS, activeNavId } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand";
import { useNavCounts } from "./use-nav-counts";

/**
 * Compact desktop navigation rail. Items open on-demand drawers over the map
 * rather than separate pages.
 */
export function NavRail({ onOpenEmergency }: { onOpenEmergency: () => void }) {
  const { currentRole } = useDemo();
  const { overlay, open, close } = useOverlay();
  const counts = useNavCounts();
  const current = activeNavId(overlay);

  const item =
    "relative w-full flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-colors";

  return (
    <aside aria-label="Main navigation" className="hidden md:flex w-[76px] shrink-0 flex-col items-center border-r border-line bg-surface py-3 gap-1">
      <div className="h-11 grid place-items-center mb-2" title="Neighbourlink · Kolkata · demo data">
        <BrandMark />
      </div>

      <button
        onClick={() => void open({ kind: "report" })}
        id="nav-report-hazard-btn"
        aria-label="Report a hazard"
        title="Report a hazard (R)"
        className="size-11 rounded-xl bg-ink text-canvas grid place-items-center hover:opacity-90 mb-2"
      >
        <Plus className="size-5" strokeWidth={2.25} />
      </button>

      <nav aria-label="Map panels" className="w-full px-2 flex flex-col gap-1">
        {NAV_ITEMS.filter((n) => !n.roles || n.roles.includes(currentRole)).map((n) => {
          const active = current === n.id;
          const count = n.countKey ? counts[n.countKey] : 0;
          return (
            <button
              key={n.id}
              onClick={() => void (n.id === "map" ? close() : open({ kind: n.id }))}
              aria-current={active ? "page" : undefined}
              aria-label={count ? `${n.label} (${count})` : n.label}
              title={n.label}
              className={cn(item, active ? "bg-surface-2 text-ink" : "text-ink-subtle hover:bg-surface-2/60 hover:text-ink")}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-accent -ml-2" />}
              <span className="relative">
                <n.icon className="size-5" strokeWidth={active ? 2 : 1.75} />
                {count > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full font-mono text-[10px] font-semibold grid place-items-center ring-2 ring-surface",
                      n.tone === "danger" ? "bg-danger text-white" : "bg-surface-3 text-ink-muted"
                    )}
                  >
                    {count}
                  </span>
                )}
              </span>
              {n.shortLabel}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="w-full px-2 flex flex-col gap-1.5">
        <button
          onClick={() => void open({ kind: "sos" })}
          id="nav-sos-help-btn"
          className="w-full h-14 rounded-xl border border-danger/35 bg-danger-soft text-danger flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold hover:bg-danger/15"
        >
          <LifeBuoy className="size-5" />
          SOS
        </button>
        <button
          onClick={onOpenEmergency}
          id="emergency-112-btn"
          className="w-full h-11 rounded-xl bg-danger text-white text-[12px] font-semibold hover:brightness-110"
          aria-label="Call emergency number 112"
        >
          112
        </button>
        <button
          onClick={() => void open({ kind: "settings" })}
          aria-label="Settings"
          title="Settings"
          className={cn(item, overlay?.kind === "settings" ? "bg-surface-2 text-ink" : "text-ink-subtle hover:bg-surface-2/60 hover:text-ink")}
        >
          <Settings2 className="size-5" strokeWidth={1.75} />
          Settings
        </button>
      </div>
    </aside>
  );
}
