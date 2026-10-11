"use client";

import React from "react";
import { MapPin, Phone } from "lucide-react";
import { INITIAL_HELP_CENTRES, type DemoHelpCentre } from "@/lib/demo-data";
import { Badge } from "@/components/ui/primitives";
import { useViewOnMap } from "./use-view-on-map";

const CATEGORY: Record<DemoHelpCentre["type"], string> = {
  SHELTER: "Shelter",
  MEDICAL_AID: "Medical aid",
  COMMUNITY_KITCHEN: "Food",
};

export function HelpPanel() {
  const viewOnMap = useViewOnMap();
  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-[12px] text-ink-subtle">
        Centres run by organisations participating in Neighbourlink. Capacity is reported by the
        centre and may lag. Call ahead where possible.
      </p>
      {INITIAL_HELP_CENTRES.map((hc) => {
        const pct = Math.round((hc.capacityAvailable / hc.capacityTotal) * 100);
        return (
          <article key={hc.id} className="rounded-xl border border-line p-3" aria-label={hc.name}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ok">{CATEGORY[hc.type]}</Badge>
              <Badge tone="accent" dot={false}>Participating</Badge>
            </div>
            <h3 className="mt-2 text-[14px] font-semibold text-ink leading-snug">{hc.name}</h3>
            <p className="text-[12px] text-ink-subtle">{hc.localityName}</p>
            <div className="mt-3">
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="text-ink-muted">Space available</span>
                <span className="font-mono text-ink">
                  {hc.capacityAvailable}
                  <span className="text-ink-subtle">/{hc.capacityTotal}</span>
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 rounded-full bg-surface-3 overflow-hidden"
                role="meter"
                aria-valuenow={hc.capacityAvailable}
                aria-valuemin={0}
                aria-valuemax={hc.capacityTotal}
                aria-label="Space available"
              >
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-ink-subtle">{hc.facilities.join(" · ")}</p>
            <div className="mt-2 -ml-2.5 flex flex-wrap">
              <button
                onClick={() => viewOnMap({ lat: hc.latitude, lng: hc.longitude }, hc.id)}
                className="h-11 md:h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink inline-flex items-center gap-1.5"
              >
                <MapPin className="size-3.5" /> View on map
              </button>
              <a
                href={`tel:${hc.contactPhone.replace(/[^\d+]/g, "")}`}
                className="h-11 md:h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink inline-flex items-center gap-1.5"
              >
                <Phone className="size-3.5" /> <span className="font-mono">{hc.contactPhone}</span>
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
