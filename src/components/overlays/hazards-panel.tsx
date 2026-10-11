"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { INITIAL_OFFICIAL_HAZARDS, INITIAL_RISK_ESTIMATES } from "@/lib/demo-data";
import { Badge, humanize } from "@/components/ui/primitives";
import { FloodRiskSimulator } from "@/components/risk/flood-risk-simulator";
import { HAZARD_TONE, RISK_TONE, formatDateTime, isStale, timeAgo } from "@/lib/status";
import { useOverlay } from "@/context/overlay-context";
import { useViewOnMap } from "./use-view-on-map";
import { LiveIndiaAlerts, LocalConditionsCard } from "./live-sections";

const rowBtn =
  "h-11 md:h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink inline-flex items-center gap-1.5";

export function HazardsPanel() {
  const { open } = useOverlay();
  const viewOnMap = useViewOnMap();
  const [showEngine, setShowEngine] = useState(false);
  // Fixed per mount so freshness labels are stable during re-renders.
  const [now] = useState(() => Date.now());

  return (
    <div className="flex flex-col">
      <LocalConditionsCard />
      <LiveIndiaAlerts />

      {/* Official */}
      <section aria-labelledby="hz-official" className="p-4 border-b border-line">
        <h3 id="hz-official" className="nl-eyebrow mb-1">Official warnings · Kolkata demo</h3>
        <p className="text-[12px] text-ink-subtle mb-3">
          Issued by government agencies. These take precedence over everything else here.
        </p>
        {INITIAL_OFFICIAL_HAZARDS.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            No official warnings are currently listed. This does not mean conditions are safe.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {INITIAL_OFFICIAL_HAZARDS.map((h) => {
              const expired = new Date(h.expiresAt).getTime() < now;
              return (
                <li key={h.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={HAZARD_TONE[h.severity]}>{humanize(h.severity)}</Badge>
                    {expired && <Badge tone="neutral">Expired</Badge>}
                    {h.isDemo && <Badge tone="neutral" dot={false}>Demo data</Badge>}
                  </div>
                  <button
                    onClick={() => open({ kind: "details", id: h.id, from: "hazards" })}
                    className="mt-2 w-full text-left group"
                  >
                    <span className="block text-[14px] font-semibold text-ink leading-snug group-hover:underline underline-offset-2">
                      {h.headline}
                    </span>
                    <span className="block mt-1 text-[12.5px] text-ink-muted line-clamp-2">{h.description}</span>
                  </button>
                  <dl className="mt-2 text-[12px] text-ink-subtle space-y-0.5">
                    <div><dt className="inline">Source: </dt><dd className="inline text-ink-muted">{h.source}</dd></div>
                    <div>
                      <dt className="inline">Issued </dt>
                      <dd className="inline text-ink-muted">
                        {formatDateTime(h.issuedAt)} ({timeAgo(h.issuedAt, now)}) · expires {formatDateTime(h.expiresAt)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-1 -ml-2.5 flex">
                    <button className={rowBtn} onClick={() => viewOnMap({ lat: h.centerLat, lng: h.centerLng }, h.id)}>
                      <MapPin className="size-3.5" /> View on map
                    </button>
                    <button className={rowBtn} onClick={() => open({ kind: "details", id: h.id, from: "hazards" })}>
                      Details <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Experimental */}
      <section aria-labelledby="hz-risk" className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 id="hz-risk" className="nl-eyebrow">Experimental flood-risk estimates</h3>
          <Badge tone="risk" dot={false}>Not a warning</Badge>
        </div>
        <p className="text-[12px] text-ink-subtle mb-3">
          Rule-based estimates from rainfall and water-level inputs. Missing inputs show
          &ldquo;insufficient data&rdquo; rather than implying safety.
        </p>
        <ul className="flex flex-col gap-2">
          {INITIAL_RISK_ESTIMATES.map((r) => {
            const stale = isStale(r.evaluatedAt, now);
            return (
              <li key={r.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={RISK_TONE[r.riskLevel]}>{humanize(r.riskLevel)} risk</Badge>
                  <span className="font-mono text-[11.5px] text-ink-subtle">{r.horizonHours}h horizon</span>
                  {stale && <Badge tone="warn" dot={false}>Inputs may be out of date</Badge>}
                </div>
                <p className="mt-2 text-[14px] font-semibold text-ink">{r.localityName}</p>
                <p className="mt-1 text-[12.5px] text-ink-muted line-clamp-2">{r.explanation}</p>
                <p className="mt-2 text-[12px] text-ink-subtle">
                  {r.modelName} · evaluated {formatDateTime(r.evaluatedAt)} ({timeAgo(r.evaluatedAt, now)})
                </p>
                <div className="mt-1 -ml-2.5 flex">
                  <button className={rowBtn} onClick={() => viewOnMap({ lat: r.centerLat, lng: r.centerLng }, r.id)}>
                    <MapPin className="size-3.5" /> View on map
                  </button>
                  <button className={rowBtn} onClick={() => open({ kind: "details", id: r.id, from: "hazards" })}>
                    Details <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => setShowEngine((v) => !v)}
          aria-expanded={showEngine}
          className="mt-4 w-full min-h-11 flex items-center justify-between rounded-lg px-1 text-[13px] font-medium text-ink"
        >
          How the estimate works — try scenarios
          <ChevronDown className={`size-4 text-ink-subtle transition-transform ${showEngine ? "rotate-180" : ""}`} />
        </button>
        {showEngine && (
          <div className="mt-2">
            <FloodRiskSimulator />
          </div>
        )}
      </section>
    </div>
  );
}
