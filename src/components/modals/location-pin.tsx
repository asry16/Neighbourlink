"use client";

import React from "react";
import { MapPin, Navigation } from "lucide-react";
import { useDemo } from "@/context/demo-context";
import { formatAccuracy } from "@/lib/use-live-location";

/**
 * Where a report / SOS will be pinned: live GPS if shared, else a point the
 * user set on the map, else the centre of their chosen area.
 */
export function useReportPosition() {
  const { liveLocation, manualLocation, currentLocality } = useDemo();
  if (liveLocation) return { lat: liveLocation.lat, lng: liveLocation.lng, source: "live" as const };
  if (manualLocation) return { ...manualLocation, source: "manual" as const };
  return { lat: currentLocality.lat, lng: currentLocality.lng, source: "area" as const };
}

export function LocationPin({ purpose }: { purpose: "report" | "sos" }) {
  const {
    liveLocation,
    manualLocation,
    locationStatus,
    locationError,
    startLiveLocation,
    currentLocality,
  } = useDemo();

  if (liveLocation) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5 text-[13px]">
        <span className="nl-live-dot text-accent shrink-0" />
        <span className="min-w-0 text-ink">
          Pinned to your <span className="font-medium">live location</span>
          <span className="ml-1.5 font-mono text-[12px] text-ink-subtle">
            {liveLocation.lat.toFixed(5)}, {liveLocation.lng.toFixed(5)} ·{" "}
            {formatAccuracy(liveLocation.accuracy)}
          </span>
        </span>
      </div>
    );
  }

  if (manualLocation) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
        <span className="size-2 rounded-full bg-ink shrink-0" />
        <span className="min-w-0 text-ink">
          Pinned to the location <span className="font-medium">you set on the map</span>
          <span className="ml-1.5 font-mono text-[12px] text-ink-subtle">
            {manualLocation.lat.toFixed(5)}, {manualLocation.lng.toFixed(5)}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
      <div className="flex items-center gap-2.5">
        <MapPin className="size-4 text-ink-subtle shrink-0" />
        <span className="min-w-0 flex-1 text-ink-muted">
          Approximate: centre of <span className="font-medium text-ink">{currentLocality.name}</span>
        </span>
        <button
          type="button"
          onClick={startLiveLocation}
          disabled={locationStatus === "requesting"}
          className="h-9 md:h-7 px-2.5 rounded-md bg-surface border border-line text-[12px] font-medium text-ink hover:border-line-strong flex items-center gap-1.5 shrink-0 disabled:opacity-60"
        >
          {locationStatus === "requesting" ? (
            <span className="size-3 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
          ) : (
            <Navigation className="size-3" />
          )}
          Use my location
        </button>
      </div>
      {purpose === "sos" && locationStatus !== "denied" && (
        <p className="mt-2 text-[12px] text-ink-subtle">
          Sharing your exact location helps rescuers find you faster. Only responders see it.
        </p>
      )}
      {(locationStatus === "denied" || locationStatus === "unavailable") && locationError && (
        <p className="mt-2 text-[12px] text-ink-muted">
          {locationError} You can also close this form and use <span className="font-medium">Set on map</span>.
        </p>
      )}
    </div>
  );
}
