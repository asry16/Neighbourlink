"use client";

import React, { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Layers, Map as MapIcon, Maximize2 } from "lucide-react";
import { useDemo, type LayerFilters } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";
import { useDismiss } from "@/lib/use-dismiss";
import { getMapTilerKey } from "@/lib/map-styles";
import { useMapApiKeyOverride } from "@/lib/map-key";
import { cn } from "@/lib/utils";
import type { MapCapabilities } from "./map-enhancements";

export const MAP_LAYERS: {
  key: keyof LayerFilters;
  label: string;
  short: string;
  dot: string;
  kind: string;
}[] = [
  { key: "liveFeeds", label: "Live disaster alerts", short: "Live alerts", dot: "bg-fuchsia-500", kind: "Real USGS earthquakes and GDACS alerts, India first" },
  { key: "officialHazards", label: "Official warnings", short: "Official", dot: "bg-orange-500", kind: "Issued by government agencies" },
  { key: "riskEstimates", label: "Flood risk", short: "Flood risk (experimental)", dot: "bg-indigo-500", kind: "Experimental estimate, not a warning" },
  { key: "communityReports", label: "Community reports", short: "Reports", dot: "bg-sky-500", kind: "Resident observations" },
  { key: "sosAreas", label: "SOS requests", short: "SOS", dot: "bg-red-500", kind: "Approximate areas for the public" },
  { key: "helpCentres", label: "Help centres", short: "Help centres", dot: "bg-emerald-500", kind: "Participating shelters and aid" },
];

/* ---------------------------------------------------------- Popover -- */

/**
 * Small map-control popover: anchored on desktop, bottom sheet on mobile
 * (portalled above the bottom nav). Closes on outside click, Escape, and
 * whenever a main overlay opens.
 */
function MapPopover({
  label,
  icon: Icon,
  buttonText,
  badge,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  icon: typeof Layers;
  buttonText: string;
  badge?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const { overlay, picking } = useOverlay();
  useDismiss([ref, sheetRef], open, close);

  // Close when a main overlay opens or choose-on-map starts — only on those
  // changes, not on every render (the parent's callback identity changes).
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    closeRef.current();
  }, [overlay, picking]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className={cn(
          "nl-glass h-11 min-w-11 md:h-9 md:min-w-9 justify-center rounded-xl px-3 flex items-center gap-2 text-[13px] font-medium transition-colors",
          open ? "text-ink" : "text-ink-muted hover:text-ink"
        )}
      >
        <Icon className="size-4" />
        <span className="hidden sm:inline">{buttonText}</span>
        {badge && <span className="font-mono text-[11px] text-ink-subtle">{badge}</span>}
      </button>

      {open && (
        <>
          <div
            id={id}
            role="dialog"
            aria-label={label}
            className="hidden md:block absolute z-50 right-0 top-full mt-2 w-72 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-xl bg-surface border border-line shadow-[var(--shadow-float)] p-3 animate-rise"
          >
            {children}
          </div>
          {createPortal(
            <div className="md:hidden">
              <div className="fixed inset-0 z-[60] bg-black/40" onClick={close} aria-hidden />
              <div
                ref={sheetRef}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                className="fixed z-[61] inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-surface border-t border-line shadow-[var(--shadow-float)] px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-rise"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[15px] font-semibold text-ink">{label}</span>
                  <button onClick={close} className="h-11 px-3 -mr-2 rounded-lg text-[13.5px] font-medium text-accent-ink">
                    Done
                  </button>
                </div>
                {children}
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------- Map type -- */

/** One real tile of the current area, from the configured provider. */
function previewUrl(type: "street" | "satellite", dark: boolean, lat: number, lng: number, key: string | null) {
  const z = 13;
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  if (key) {
    return type === "satellite"
      ? `https://api.maptiler.com/tiles/satellite-v2/${z}/${x}/${y}.jpg?key=${key}`
      : `https://api.maptiler.com/maps/${dark ? "streets-v2-dark" : "streets-v2"}/256/${z}/${x}/${y}.png?key=${key}`;
  }
  return type === "satellite"
    ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
    : `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${dark ? "Dark" : "Light"}_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
}

export function MapTypePopover({
  open,
  onOpenChange,
  isDark,
  is3D,
  capabilities,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  is3D: boolean;
  capabilities: MapCapabilities;
}) {
  const { basemapType, setBasemapType, satelliteLabels, setSatelliteLabels, currentLocality } = useDemo();
  const key = getMapTilerKey(useMapApiKeyOverride());

  return (
    <MapPopover label="Map type" icon={MapIcon} buttonText={basemapType === "satellite" ? "Satellite" : "Street"} open={open} onOpenChange={onOpenChange}>
      <div role="radiogroup" aria-label="Map type" className="grid grid-cols-2 gap-2">
        {(["street", "satellite"] as const).map((t) => {
          const active = basemapType === t;
          return (
            <button
              key={t}
              role="radio"
              aria-checked={active}
              onClick={() => setBasemapType(t)}
              className={cn(
                "rounded-xl border-2 p-1 text-left transition-colors",
                active ? "border-accent" : "border-transparent hover:border-line-strong"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote map tile preview */}
              <img
                src={previewUrl(t, isDark, currentLocality.lat, currentLocality.lng, key)}
                alt=""
                loading="lazy"
                onError={(e) => {
                  const fallback = previewUrl(t, isDark, currentLocality.lat, currentLocality.lng, null);
                  if (e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  }
                }}
                className="aspect-[4/3] w-full rounded-lg object-cover bg-surface-3"
              />
              <span className={cn("block px-1 pt-1.5 pb-0.5 text-[13px] font-medium", active ? "text-accent-ink" : "text-ink")}>
                {t === "street" ? "Street" : "Satellite"}
              </span>
            </button>
          );
        })}
      </div>
      {basemapType === "satellite" && (
        <>
          <button
            role="switch"
            aria-checked={satelliteLabels}
            onClick={() => setSatelliteLabels(!satelliteLabels)}
            className="mt-2 w-full min-h-11 flex items-center gap-3 px-1 text-left"
          >
            <span className="flex-1 text-[13px] text-ink">Road and place labels</span>
            <Switch on={satelliteLabels} />
          </button>
          <p className="px-1 text-[12px] text-ink-subtle">Imagery is periodic, not live.</p>
        </>
      )}
      {is3D && (
        <p className="mt-2 px-1 text-[12px] leading-snug text-ink-subtle">
          3D:{" "}
          {capabilities.buildings
            ? "buildings from OpenStreetMap footprints (heights estimated where not recorded)"
            : "no building data on this basemap"}
          {capabilities.terrain ? "; terrain at true scale." : "."}
        </p>
      )}
    </MapPopover>
  );
}

/* ----------------------------------------------------------- Layers -- */

export function LayersPopover({
  open,
  onOpenChange,
  layerFilters,
  toggleLayer,
  onFitAll,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layerFilters: LayerFilters;
  toggleLayer: (key: keyof LayerFilters) => void;
  onFitAll: () => void;
}) {
  const activeCount = Object.values(layerFilters).filter(Boolean).length;
  return (
    <MapPopover
      label="Hazard layers"
      icon={Layers}
      buttonText="Layers"
      badge={`${activeCount}/${MAP_LAYERS.length}`}
      open={open}
      onOpenChange={onOpenChange}
    >
      {MAP_LAYERS.map((layer) => {
        const on = layerFilters[layer.key];
        return (
          <button
            key={layer.key}
            role="switch"
            aria-checked={on}
            onClick={() => toggleLayer(layer.key)}
            className="w-full min-h-11 md:min-h-10 flex items-center gap-3 px-1 rounded-lg hover:bg-surface-2 text-left"
          >
            <span className={cn("size-2.5 rounded-full shrink-0", layer.dot, !on && "opacity-30")} />
            <span className="flex-1 min-w-0">
              <span className={cn("block text-[13px]", on ? "text-ink" : "text-ink-subtle")}>{layer.label}</span>
              <span className="block text-[12px] text-ink-subtle">{layer.kind}</span>
            </span>
            <Switch on={on} />
          </button>
        );
      })}
      <button
        onClick={onFitAll}
        className="mt-2 w-full h-11 md:h-9 rounded-lg border border-line text-[13px] font-medium text-ink hover:bg-surface-2 flex items-center justify-center gap-1.5"
      >
        <Maximize2 className="size-3.5" /> Fit map to active items
      </button>
    </MapPopover>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={cn("relative shrink-0 w-9 h-5 rounded-full transition-colors", on ? "bg-accent" : "bg-surface-3")}>
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]", on ? "left-[18px]" : "left-0.5")} />
    </span>
  );
}
