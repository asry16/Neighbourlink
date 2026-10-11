"use client";

import React from "react";
import { Crosshair, MapPin, Navigation } from "lucide-react";
import { useDemo } from "@/context/demo-context";
import { useOverlay, type LatLng } from "@/context/overlay-context";
import { formatAccuracy } from "@/lib/use-live-location";

export type PickedLocation = LatLng & {
  source: "live" | "manual" | "area" | "picked";
  /** The area is a country / state overview, too broad to place anything. */
  tooBroad?: boolean;
};

/** Default position: live GPS, else a point set on the map, else the area centre. */
export function useDefaultPosition(): PickedLocation {
  const { liveLocation, manualLocation, currentLocality } = useDemo();
  if (liveLocation) return { lat: liveLocation.lat, lng: liveLocation.lng, source: "live" };
  if (manualLocation) return { ...manualLocation, source: "manual" };
  return { lat: currentLocality.lat, lng: currentLocality.lng, source: "area", tooBroad: currentLocality.isOverview };
}

const SOURCE_LABEL: Record<PickedLocation["source"], string> = {
  live: "Your live location",
  manual: "The location you set on the map",
  area: "Approximate: centre of your area",
  picked: "Location you chose on the map",
};

/**
 * Where a report / SOS will be placed, with "use my location" and "choose on
 * map". Choosing on the map hides the form (draft kept) until confirmed.
 */
export function LocationField({
  value,
  onChange,
  purpose,
}: {
  /** null = follow the default (live / manual / area). */
  value: PickedLocation | null;
  onChange: (v: PickedLocation | null) => void;
  purpose: "report" | "sos";
}) {
  const { liveLocation, locationStatus, locationError, startLiveLocation } = useDemo();
  const { pickLocation } = useOverlay();
  const fallback = useDefaultPosition();
  const current = value ?? fallback;

  const choose = async () => {
    const picked = await pickLocation(purpose, { lat: current.lat, lng: current.lng });
    if (picked) onChange({ ...picked, source: "picked" });
  };

  return (
    <div className="rounded-lg border border-line bg-surface-2/50 p-3">
      <div className="flex items-start gap-2.5">
        {current.source === "live" ? (
          <span className="nl-live-dot text-accent mt-1.5 shrink-0" />
        ) : (
          <MapPin className="size-4 mt-0.5 shrink-0 text-ink-subtle" />
        )}
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="text-ink font-medium">
            {current.tooBroad ? "Where are you? Use your location or choose on the map" : SOURCE_LABEL[current.source]}
          </div>
          <div className="font-mono text-[12px] text-ink-subtle">
            {current.lat.toFixed(5)}, {current.lng.toFixed(5)}
            {current.source === "live" && liveLocation && ` · ${formatAccuracy(liveLocation.accuracy)}`}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          data-return-focus
          onClick={choose}
          className="h-11 md:h-8 px-3 rounded-md bg-surface border border-line text-[12.5px] font-medium text-ink hover:border-line-strong inline-flex items-center gap-1.5"
        >
          <Crosshair className="size-3.5" /> Choose on map
        </button>
        {!liveLocation && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              startLiveLocation();
            }}
            disabled={locationStatus === "requesting"}
            className="h-11 md:h-8 px-3 rounded-md bg-surface border border-line text-[12.5px] font-medium text-ink hover:border-line-strong inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {locationStatus === "requesting" ? (
              <span className="size-3 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
            ) : (
              <Navigation className="size-3.5" />
            )}
            Use my location
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-11 md:h-8 px-3 rounded-md text-[12.5px] font-medium text-ink-muted hover:text-ink"
          >
            Reset
          </button>
        )}
      </div>
      {purpose === "sos" && current.source === "area" && (
        <p className="mt-2 text-[12px] text-ink-subtle">
          An exact location helps rescuers find you faster. Only verified responders see it.
        </p>
      )}
      {(locationStatus === "denied" || locationStatus === "unavailable") && locationError && !value && (
        <p className="mt-2 text-[12px] text-ink-muted">{locationError} Use “Choose on map” instead.</p>
      )}
    </div>
  );
}
