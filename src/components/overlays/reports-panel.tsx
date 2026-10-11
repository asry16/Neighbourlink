"use client";

import React, { useState } from "react";
import { ChevronRight, Eye, MapPin, Plus } from "lucide-react";
import { useDemo } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";
import { Badge, humanize } from "@/components/ui/primitives";
import { INCIDENT_TONE, timeAgo } from "@/lib/status";
import type { DemoIncident } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { useViewOnMap } from "./use-view-on-map";

const CATEGORIES: { value: "ALL" | DemoIncident["category"]; label: string }[] = [
  { value: "ALL", label: "All types" },
  { value: "FLOOD_WATERLOGGING", label: "Flooding" },
  { value: "STORM_DAMAGE", label: "Storm" },
  { value: "LANDSLIDE", label: "Landslide" },
  { value: "EARTHQUAKE_OBSERVATION", label: "Earthquake" },
  { value: "OTHER_HAZARD", label: "Other" },
];

const STATUSES: { value: "ACTIVE" | "ALL" | DemoIncident["status"]; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "ALL", label: "All" },
  { value: "UNVERIFIED", label: "Unverified" },
  { value: "CORROBORATED", label: "Corroborated" },
  { value: "DISPUTED", label: "Disputed" },
  { value: "RESOLVED", label: "Resolved" },
];

const chip = (active: boolean) =>
  cn(
    "h-11 md:h-9 px-3.5 shrink-0 rounded-full text-[13px] md:text-[12.5px] font-medium border whitespace-nowrap transition-colors",
    active ? "bg-ink text-canvas border-ink" : "bg-surface text-ink-muted border-line hover:text-ink"
  );

/** Community observations. Selecting one shows its details in this same drawer. */
export function ReportsPanel() {
  const { incidents } = useDemo();
  const { open } = useOverlay();
  const viewOnMap = useViewOnMap();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("ALL");
  const [status, setStatus] = useState<(typeof STATUSES)[number]["value"]>("ACTIVE");

  const list = incidents
    .filter((i) => category === "ALL" || i.category === category)
    .filter((i) =>
      status === "ALL" ? true : status === "ACTIVE" ? i.status !== "RESOLVED" : i.status === status
    )
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());

  return (
    <div>
      <div className="p-4 pb-3 border-b border-line space-y-2">
        <p className="text-[12px] text-ink-subtle">
          Submitted by residents. Reports gain trust as neighbours independently confirm them.
        </p>
        <div role="group" aria-label="Filter by type" className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5">
          {CATEGORIES.map((c) => (
            <button key={c.value} aria-pressed={category === c.value} onClick={() => setCategory(c.value)} className={chip(category === c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filter by status" className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5">
          {STATUSES.map((s) => (
            <button key={s.value} aria-pressed={status === s.value} onClick={() => setStatus(s.value)} className={chip(status === s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-[14px] font-medium text-ink">No reports match these filters</p>
          <p className="mt-1 text-[13px] text-ink-subtle">
            That doesn&apos;t mean the area is safe — it means nobody has reported it here yet.
          </p>
          <button
            onClick={() => open({ kind: "report" })}
            className="mt-4 h-11 px-4 rounded-lg bg-ink text-canvas text-[13px] font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="size-4" /> Report a hazard
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((inc) => (
            <li key={inc.id} className="px-4 py-3">
              <button
                onClick={() => open({ kind: "details", id: inc.id, from: "reports" })}
                className="w-full text-left group flex items-start gap-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={INCIDENT_TONE[inc.status]}>{humanize(inc.status)}</Badge>
                    <span className="font-mono text-[11.5px] text-ink-subtle">{inc.trackingCode}</span>
                  </span>
                  <span className="mt-1.5 block text-[14px] font-semibold text-ink group-hover:underline underline-offset-2">
                    {inc.categoryLabel}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-muted line-clamp-2">{inc.description}</span>
                  <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-subtle">
                    <span>{inc.localityName}</span>
                    <span>{timeAgo(inc.observedAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3" /> {inc.observationCount}
                    </span>
                  </span>
                </span>
                <ChevronRight className="size-4 mt-1 text-ink-subtle shrink-0" />
              </button>
              <button
                onClick={() => viewOnMap({ lat: inc.latitude, lng: inc.longitude }, inc.id)}
                className="mt-1 -ml-2.5 h-11 md:h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink inline-flex items-center gap-1.5"
              >
                <MapPin className="size-3.5" /> View on map
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
