"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, MapPin, Plus, LifeBuoy, Phone, Users, Eye } from "lucide-react";
import {
  INITIAL_OFFICIAL_HAZARDS,
  INITIAL_RISK_ESTIMATES,
  INITIAL_HELP_CENTRES,
  type DemoIncident,
} from "@/lib/demo-data";
import { useDemo } from "@/context/demo-context";
import { FloodRiskSimulator } from "@/components/risk/flood-risk-simulator";
import { Badge, Button, Card, Meta, SectionHeader, humanize } from "@/components/ui/primitives";
import {
  HAZARD_TONE,
  INCIDENT_TONE,
  RISK_TONE,
  SOS_CATEGORY_LABEL,
  SOS_TONE,
  formatClock,
} from "@/lib/status";
import { cn } from "@/lib/utils";

interface ListViewProps {
  focusSection?: string;
  onSelectIncident: (id: string) => void;
  onOpenReportModal: () => void;
  onOpenSosModal: () => void;
  onShowOnMap?: (coords: { lat: number; lng: number }, id?: string) => void;
}

const CATEGORY_FILTERS: { value: "ALL" | DemoIncident["category"]; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "FLOOD_WATERLOGGING", label: "Flooding" },
  { value: "STORM_DAMAGE", label: "Storm damage" },
  { value: "LANDSLIDE", label: "Landslide" },
  { value: "EARTHQUAKE_OBSERVATION", label: "Earthquake" },
];

const HELP_CENTRE_LABEL = {
  SHELTER: "Relief shelter",
  MEDICAL_AID: "Medical aid",
  COMMUNITY_KITCHEN: "Community kitchen",
} as const;

export function ListView({
  focusSection,
  onSelectIncident,
  onOpenReportModal,
  onOpenSosModal,
  onShowOnMap,
}: ListViewProps) {
  const { currentRole, currentLocality, incidents, sosRequests, acknowledgeSOS } = useDemo();
  const [filterCategory, setFilterCategory] = useState<(typeof CATEGORY_FILTERS)[number]["value"]>("ALL");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isResponder = currentRole === "RESPONDER" || currentRole === "ADMIN";

  // Nav tabs map to sections of this feed — scroll to the requested one.
  useEffect(() => {
    if (!focusSection) return;
    const el = document.getElementById(focusSection);
    if (!el || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
  }, [focusSection]);

  const filteredIncidents = incidents.filter(
    (inc) => filterCategory === "ALL" || inc.category === filterCategory
  );
  const openSos = sosRequests.filter((s) => s.status !== "RESOLVED");
  const bedsFree = INITIAL_HELP_CENTRES.reduce((n, c) => n + c.capacityAvailable, 0);

  const stats = [
    { label: "Official alerts", value: INITIAL_OFFICIAL_HAZARDS.length, href: "feed-hazards" },
    { label: "Active reports", value: incidents.filter((i) => i.status !== "RESOLVED").length, href: "feed-reports" },
    { label: "Open SOS", value: openSos.length, href: "feed-sos", danger: openSos.length > 0 },
    { label: "Shelter beds free", value: bedsFree, href: "feed-shelters" },
  ];

  const mapButton = (lat: number, lng: number, id: string) =>
    onShowOnMap && (
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onShowOnMap({ lat, lng }, id);
        }}
      >
        <MapPin /> Map
      </Button>
    );

  return (
    <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-6 md:py-10 flex flex-col gap-12">
        {/* Header */}
        <header>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="nl-eyebrow flex items-center gap-2">
                <span className="nl-live-dot text-ok" /> Live · {currentLocality.name}
              </div>
              <h1 className="mt-2 text-[30px] md:text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
                What&apos;s happening nearby
              </h1>
              <p className="mt-2 text-[14px] text-ink-muted max-w-xl">
                Official bulletins, community observations and open emergency requests for your
                sector, in one place.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={onOpenReportModal}>
                <Plus /> Report hazard
              </Button>
              <Button
                onClick={onOpenSosModal}
                className="border-danger/30 text-danger hover:bg-danger-soft"
              >
                <LifeBuoy /> Request SOS
              </Button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px rounded-[var(--radius-card)] border border-line bg-line overflow-hidden">
            {stats.map((s) => (
              <button
                key={s.label}
                onClick={() =>
                  scrollRef.current?.scrollTo({
                    top: (document.getElementById(s.href)?.offsetTop ?? 0) - 24,
                    behavior: "smooth",
                  })
                }
                className="text-left px-5 py-4 bg-surface hover:bg-surface-2 transition-colors"
              >
                <div
                  className={cn(
                    "font-display text-[28px] font-semibold tabular-nums leading-none",
                    s.danger ? "text-danger" : "text-ink"
                  )}
                >
                  {s.value}
                </div>
                <div className="mt-2 text-[12.5px] text-ink-subtle">{s.label}</div>
              </button>
            ))}
          </div>
        </header>

        {/* 01 — Official alerts */}
        <section id="feed-hazards" className="scroll-mt-6">
          <SectionHeader
            index="01 — Official"
            title="Hazard advisories"
            description="Bulletins from meteorological and geological agencies. These take precedence over community reports."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INITIAL_OFFICIAL_HAZARDS.map((haz) => (
              <Card key={haz.id} className="p-5 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={HAZARD_TONE[haz.severity]}>{humanize(haz.severity)}</Badge>
                  <span className="font-mono text-[11.5px] text-ink-subtle">
                    Issued {formatClock(haz.issuedAt)}
                  </span>
                </div>
                <h3 className="mt-3 text-[15.5px] font-semibold leading-snug text-ink">
                  {haz.headline}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted flex-1">
                  {haz.description}
                </p>
                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                  <span className="text-[12px] text-ink-subtle truncate">{haz.source}</span>
                  {mapButton(haz.centerLat, haz.centerLng, haz.id)}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* 02 — Flood-risk outlook */}
        <section id="feed-risk" className="scroll-mt-6">
          <SectionHeader
            index="02 — Estimate"
            title="Flood-risk outlook"
            description="A transparent, rule-based indicator — not an official warning. Missing inputs return “insufficient data” rather than implying safety."
            actions={<Badge tone="risk" dot={false}>Rule engine v1.0</Badge>}
          />
          <div className="flex flex-col gap-3">
            <FloodRiskSimulator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {INITIAL_RISK_ESTIMATES.map((risk) => (
                <Card key={risk.id} className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={RISK_TONE[risk.riskLevel]}>{humanize(risk.riskLevel)} risk</Badge>
                    <span className="font-mono text-[11.5px] text-ink-subtle">
                      {risk.horizonHours}h horizon
                    </span>
                  </div>
                  <h3 className="mt-3 text-[15.5px] font-semibold text-ink">{risk.localityName}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
                    {risk.explanation}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-surface-2 px-3.5 py-3">
                    <Meta label="Rain 24h" value={`${risk.rainfallRecentMm ?? "—"} mm`} />
                    <Meta label="Forecast" value={`${risk.rainfallForecastMm ?? "—"} mm`} />
                    <Meta label="Gauge" value={`${risk.waterLevelMeters ?? "—"} m`} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    {mapButton(risk.centerLat, risk.centerLng, risk.id)}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* 03 — Community reports */}
        <section id="feed-reports" className="scroll-mt-6">
          <SectionHeader
            index="03 — Community"
            title="Observation reports"
            description="Submitted by residents. Reports gain trust as independent neighbours corroborate them."
          />

          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
            {CATEGORY_FILTERS.map((f) => {
              const active = filterCategory === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilterCategory(f.value)}
                  aria-pressed={active}
                  className={cn(
                    "h-8 px-3 rounded-full text-[12.5px] font-medium border transition-colors whitespace-nowrap",
                    active
                      ? "bg-ink text-canvas border-ink"
                      : "bg-surface text-ink-muted border-line hover:text-ink hover:border-line-strong"
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {filteredIncidents.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center">
              <p className="text-[14px] font-medium text-ink">No reports in this category</p>
              <p className="mt-1 text-[13px] text-ink-subtle">
                Seen something? Your report helps neighbours stay safe.
              </p>
              <Button variant="primary" className="mt-4" onClick={onOpenReportModal}>
                <Plus /> Report hazard
              </Button>
            </div>
          ) : (
            <Card className="divide-y divide-line overflow-hidden">
              {filteredIncidents.map((inc) => (
                <div
                  key={inc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectIncident(inc.id)}
                  onKeyDown={(e) => e.key === "Enter" && onSelectIncident(inc.id)}
                  className="group px-5 py-4 flex items-center gap-4 hover:bg-surface-2/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={INCIDENT_TONE[inc.status]}>{humanize(inc.status)}</Badge>
                      <span className="font-mono text-[11.5px] text-ink-subtle">{inc.trackingCode}</span>
                    </div>
                    <h3 className="mt-2 text-[15px] font-semibold text-ink">{inc.categoryLabel}</h3>
                    <p className="mt-1 text-[13.5px] text-ink-muted line-clamp-2">{inc.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-subtle">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5" /> {inc.localityName}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="size-3.5" /> {inc.observationCount} observation
                        {inc.observationCount === 1 ? "" : "s"}
                      </span>
                      {inc.reportedImpact && <span>Impact: {inc.reportedImpact}</span>}
                    </div>
                  </div>
                  <div className="hidden sm:block">{mapButton(inc.latitude, inc.longitude, inc.id)}</div>
                  <ChevronRight className="size-4 text-ink-subtle group-hover:text-ink group-hover:translate-x-0.5 transition" />
                </div>
              ))}
            </Card>
          )}
        </section>

        {/* 04 — SOS queue */}
        <section id="feed-sos" className="scroll-mt-6">
          <SectionHeader
            index="04 — Emergency"
            title="SOS queue"
            description={
              isResponder
                ? "Exact locations and callback numbers are visible to verified responders only."
                : "Locations are blurred to roughly 1 km to protect people requesting help."
            }
          />
          {openSos.length === 0 ? (
            <Card className="px-6 py-10 text-center text-[13.5px] text-ink-subtle">
              No open emergency requests in this sector.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {openSos.map((sos) => (
                <Card
                  key={sos.id}
                  className="relative overflow-hidden p-5 pl-6 flex flex-col md:flex-row md:items-center gap-4"
                >
                  <span className="absolute left-0 inset-y-0 w-1 bg-danger" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={SOS_TONE[sos.status as keyof typeof SOS_TONE]}>
                        {humanize(sos.status)}
                      </Badge>
                      <span className="font-mono text-[11.5px] text-ink-subtle">{sos.trackingCode}</span>
                      <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-muted">
                        <Users className="size-3.5" /> {sos.peopleCount}{" "}
                        {sos.peopleCount === 1 ? "person" : "people"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-[15px] font-semibold text-ink">
                      {SOS_CATEGORY_LABEL[sos.category as keyof typeof SOS_CATEGORY_LABEL] ??
                        "Emergency request"}
                    </h3>
                    <p className="mt-1 text-[13.5px] text-ink-muted">
                      {isResponder
                        ? sos.description
                        : "Rescue requested. Approximate area shown to protect privacy."}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-subtle">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5" /> {sos.localityName}
                      </span>
                      {isResponder && (
                        <span className="inline-flex items-center gap-1.5 text-ink">
                          <Phone className="size-3.5" />
                          <span className="font-mono">{sos.contactPhone}</span> · {sos.requesterName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onShowOnMap && (
                      <Button
                        size="sm"
                        onClick={() =>
                          onShowOnMap(
                            {
                              lat: isResponder ? sos.exactLatitude : sos.fuzzyLatitude,
                              lng: isResponder ? sos.exactLongitude : sos.fuzzyLongitude,
                            },
                            sos.id
                          )
                        }
                      >
                        <MapPin /> Show on map
                      </Button>
                    )}
                    {isResponder && sos.status === "REQUESTED" && (
                      <Button size="sm" variant="primary" onClick={() => acknowledgeSOS(sos.id)}>
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* 05 — Help centres */}
        <section id="feed-shelters" className="scroll-mt-6 pb-8">
          <SectionHeader
            index="05 — Support"
            title="Help centres"
            description="Shelters and aid stations with live capacity."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INITIAL_HELP_CENTRES.map((hc) => {
              const pct = Math.round((hc.capacityAvailable / hc.capacityTotal) * 100);
              return (
                <Card key={hc.id} className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="ok">{HELP_CENTRE_LABEL[hc.type]}</Badge>
                    {mapButton(hc.latitude, hc.longitude, hc.id)}
                  </div>
                  <h3 className="mt-3 text-[15.5px] font-semibold text-ink leading-snug">{hc.name}</h3>
                  <p className="mt-1 text-[12.5px] text-ink-subtle">{hc.localityName}</p>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-[12.5px]">
                      <span className="text-ink-muted">Capacity available</span>
                      <span className="font-mono text-ink">
                        {hc.capacityAvailable}
                        <span className="text-ink-subtle">/{hc.capacityTotal}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {hc.facilities.map((f) => (
                      <span
                        key={f}
                        className="h-6 px-2 rounded-md bg-surface-2 text-[11.5px] text-ink-muted inline-flex items-center"
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  <a
                    href={`tel:${hc.contactPhone.replace(/[^\d+]/g, "")}`}
                    className="mt-4 pt-3 border-t border-line flex items-center gap-2 text-[13px] text-ink-muted hover:text-ink"
                  >
                    <Phone className="size-3.5" />
                    <span className="font-mono">{hc.contactPhone}</span>
                  </a>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
