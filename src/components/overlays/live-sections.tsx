"use client";

import React, { useEffect, useState } from "react";
import { MapPin, RefreshCw, ExternalLink } from "lucide-react";
import { useDemo } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";
import { Badge, humanize } from "@/components/ui/primitives";
import { RISK_TONE, timeAgo } from "@/lib/status";
import { NAQI_ADVICE, NAQI_TONE } from "@/lib/air-quality";
import { weatherLabel, type CurrentWeather } from "@/lib/weather";
import type { LiveHazard, LocalConditions } from "@/lib/live-types";
import { cn } from "@/lib/utils";

const rowBtn =
  "h-11 md:h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink inline-flex items-center gap-1.5";

interface Loaded {
  key: string;
  conditions: LocalConditions | null;
  weather: CurrentWeather | null;
  failed: boolean;
}

/** Live weather, India AQI and flood risk for the area being viewed. */
export function LocalConditionsCard() {
  const { currentLocality } = useDemo();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${currentLocality.id}:${attempt}`;

  useEffect(() => {
    if (currentLocality.isOverview) return;
    let cancelled = false;
    const q = `lat=${currentLocality.lat.toFixed(3)}&lng=${currentLocality.lng.toFixed(3)}`;
    Promise.allSettled([
      fetch(`/api/conditions?${q}`).then((r) => r.json()),
      fetch(`/api/weather?${q}`).then((r) => r.json()),
    ]).then(([c, w]) => {
      if (cancelled) return;
      const conditions = c.status === "fulfilled" && c.value.success ? (c.value.data as LocalConditions) : null;
      const weather = w.status === "fulfilled" && w.value.success ? (w.value.data as CurrentWeather) : null;
      setLoaded({ key, conditions, weather, failed: !conditions && !weather });
    });
    return () => {
      cancelled = true;
    };
  }, [currentLocality, key]);

  if (currentLocality.isOverview) {
    return (
      <section className="p-4 border-b border-line">
        <h3 className="nl-eyebrow mb-1">Conditions here</h3>
        <p className="text-[13px] text-ink-muted">
          Search any city or town in India to see its live weather, air quality (India AQI) and flood risk.
        </p>
      </section>
    );
  }

  const data = loaded?.key === key ? loaded : null;
  const aq = data?.conditions?.airQuality;
  const flood = data?.conditions?.floodRisk;
  const w = data?.weather;

  return (
    <section aria-labelledby="hz-local" className="p-4 border-b border-line" aria-busy={!data}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 id="hz-local" className="nl-eyebrow">Conditions here · live</h3>
          <p className="text-[13px] font-medium text-ink truncate">{currentLocality.name}</p>
        </div>
        <button onClick={() => setAttempt((a) => a + 1)} className={rowBtn} aria-label="Refresh conditions">
          <RefreshCw className={cn("size-3.5", !data && "animate-spin")} />
        </button>
      </div>

      {!data ? (
        <p className="text-[13px] text-ink-subtle">Fetching live data…</p>
      ) : data.failed ? (
        <p className="text-[13px] text-ink-muted">Live data is unavailable right now. Try refresh.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {w && (
            <div className="text-[13px] text-ink">
              <span className="font-medium">{weatherLabel(w.weatherCode)}</span> · {Math.round(w.temperatureC)}°C, feels{" "}
              {Math.round(w.feelsLikeC)}° · {w.humidityPct}% humidity · wind {Math.round(w.windKmh)} km/h
            </div>
          )}

          {aq ? (
            <div className="rounded-xl border border-line p-3 flex gap-3">
              <div className={cn("shrink-0 w-16 rounded-lg grid place-items-center py-2", NAQI_TONE[aq.category])}>
                <span className="text-[22px] font-semibold leading-none">{aq.aqi}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide opacity-90 mt-1">AQI</span>
              </div>
              <div className="min-w-0 text-[12.5px]">
                <div className="text-[14px] font-semibold text-ink">{aq.category}</div>
                <div className="text-ink-muted leading-snug">{NAQI_ADVICE[aq.category]}</div>
                <div className="mt-1 text-[11.5px] text-ink-subtle">
                  24 h avg PM2.5 {aq.pm25Avg24h} · PM10 {aq.pm10Avg24h} µg/m³ · driven by {aq.dominant}
                </div>
                <div className="text-[11px] text-ink-subtle">India NAQI (CPCB method) from CAMS model data</div>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-subtle">Air quality unavailable.</p>
          )}

          {flood ? (
            <div className="rounded-xl border border-line p-3 text-[12.5px]">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink">Flood risk (next 24 h)</span>
                <Badge tone={RISK_TONE[flood.riskLevel]}>{humanize(flood.riskLevel)}</Badge>
              </div>
              <p className="mt-1 text-ink-muted leading-snug line-clamp-3">{flood.explanation}</p>
              <div className="mt-1.5 text-[11.5px] text-ink-subtle">
                Rain past 24 h {flood.rainfallPast24hMm ?? "–"} mm · next 24 h {flood.rainfallNext24hMm ?? "–"} mm
                {flood.riverDischargeRatio != null && ` · river ${flood.riverDischargeRatio}× seasonal median`}
              </div>
              <div className="text-[11px] text-ink-subtle">{flood.disclaimer}</div>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-subtle">Flood risk unavailable.</p>
          )}
        </div>
      )}
    </section>
  );
}

const TYPE_LABEL: Record<LiveHazard["type"], string> = {
  EARTHQUAKE: "Earthquake",
  CYCLONE: "Cyclone",
  FLOOD: "Flood",
  DROUGHT: "Drought",
  WILDFIRE: "Wildfire",
  VOLCANO: "Volcano",
  OTHER: "Hazard",
};

/** Real events across India from USGS and GDACS. */
export function LiveIndiaAlerts() {
  const { liveHazards, liveHazardsError, refreshLiveHazards, requestMapFocus, setSelectedIncidentId, layerFilters, toggleLayer } =
    useDemo();
  const { setSheetCollapsed } = useOverlay();
  const [now] = useState(() => Date.now());
  const [showAll, setShowAll] = useState(false);

  const viewOnMap = (h: LiveHazard) => {
    if (!layerFilters.liveFeeds) toggleLayer("liveFeeds");
    setSelectedIncidentId(h.id);
    requestMapFocus({ lat: h.latitude, lng: h.longitude, zoom: h.type === "EARTHQUAKE" ? 7.5 : 6.5 });
    setSheetCollapsed(true);
  };

  const hazards = liveHazards?.hazards ?? [];
  const shown = showAll ? hazards : hazards.slice(0, 6);
  const activeCount = hazards.filter((h) => h.isCurrent).length;

  return (
    <section aria-labelledby="hz-live" className="p-4 border-b border-line">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="hz-live" className="nl-eyebrow mb-1 flex items-center gap-1.5">
            <span className="nl-live-dot text-danger" /> Live across India
          </h3>
          <p className="text-[12px] text-ink-subtle mb-3">
            Real-time USGS earthquakes (7 days) and GDACS cyclone, flood and drought alerts (30 days).
            {liveHazards && ` Updated ${timeAgo(liveHazards.fetchedAt, now)}.`}
          </p>
        </div>
        <button onClick={() => void refreshLiveHazards()} className={rowBtn} aria-label="Refresh live alerts">
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {liveHazards?.sources.some((s) => !s.ok) && (
        <p className="mb-2 text-[12px] text-warn">
          {liveHazards.sources.filter((s) => !s.ok).map((s) => s.name).join(" and ")} feed unavailable right now.
        </p>
      )}

      {!liveHazards ? (
        <p className="text-[13px] text-ink-muted">
          {liveHazardsError ? "Live feeds are unavailable right now." : "Loading live feeds…"}
        </p>
      ) : hazards.length === 0 ? (
        <p className="text-[13px] text-ink-muted">No events in the feeds right now. This does not mean conditions are safe.</p>
      ) : (
        <>
          {activeCount > 0 && (
            <p className="mb-2 text-[12.5px] font-medium text-ink">
              {activeCount} active {activeCount === 1 ? "event" : "events"}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {shown.map((h) => (
              <li key={h.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={h.alertLevel === "RED" ? "danger" : h.alertLevel === "ORANGE" ? "warn" : "accent"}>
                    {TYPE_LABEL[h.type]}
                  </Badge>
                  {h.alertLevel && <Badge tone="neutral" dot={false}>{humanize(h.alertLevel)} alert</Badge>}
                  <Badge tone={h.isCurrent ? "danger" : "neutral"} dot={h.isCurrent}>
                    {h.isCurrent ? "Active" : "Past"}
                  </Badge>
                  <span className="ml-auto text-[11px] font-mono text-ink-subtle">{h.source}</span>
                </div>
                <div className="mt-1.5 text-[14px] font-semibold text-ink leading-snug">{h.title}</div>
                <div className="text-[12.5px] text-ink-muted">{h.detail}</div>
                <div className="text-[11.5px] text-ink-subtle">Started {timeAgo(h.startedAt, now)}</div>
                <div className="mt-1 -ml-2.5 flex">
                  <button className={rowBtn} onClick={() => viewOnMap(h)}>
                    <MapPin className="size-3.5" /> View on map
                  </button>
                  <a className={rowBtn} href={h.url} target="_blank" rel="noopener noreferrer">
                    Source <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {hazards.length > 6 && (
            <button onClick={() => setShowAll((v) => !v)} className={cn(rowBtn, "mt-2 -ml-2.5")}>
              {showAll ? "Show fewer" : `Show all ${hazards.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
