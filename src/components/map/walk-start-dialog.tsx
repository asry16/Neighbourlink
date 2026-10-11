"use client";

import React, { useEffect, useRef, useState } from "react";
import { Crosshair, LocateFixed, MapPin, Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { PlaceResult } from "@/lib/places";

export interface WalkStart {
  lat: number;
  lng: number;
  /** Shown in walk mode so people know where they are. */
  label: string;
  /** Name other walkers see above your character. */
  name: string;
}

type GpsState = { status: "idle" } | { status: "locating" } | { status: "error"; message: string };

/**
 * Asks where to start walking: the device's GPS position, or a city / place
 * typed in. The map centre is offered as a fallback.
 */
export function WalkStartDialog({
  open,
  onClose,
  onStart,
  mapCentre,
  defaultName,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (start: WalkStart) => void;
  mapCentre: () => { lat: number; lng: number };
  defaultName: string;
}) {
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [name, setName] = useState(defaultName);
  const go = (place: { lat: number; lng: number; label: string }) =>
    onStart({ ...place, name: name.trim() || defaultName });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Debounced place search; only the latest response is applied.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        // Whole world, with places in India listed first.
        const res = await fetch(`/api/geocode?prefer=IN&q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (id !== requestId.current) return;
        if (!res.ok || !json.success) throw new Error(json.error);
        setResults(json.data);
      } catch {
        if (id === requestId.current) setSearchError("Place search is unavailable right now.");
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const useGps = () => {
    if (!("geolocation" in navigator)) {
      setGps({ status: "error", message: "This browser can't share its location. Type your city instead." });
      return;
    }
    setGps({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ status: "idle" });
        go({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your location" });
      },
      (err) =>
        setGps({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location access was blocked. Allow it in your browser, or type your city below."
              : "Couldn't get a GPS fix. Try again, or type your city below.",
        }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const placeLabel = (p: PlaceResult) => [p.name, p.region, p.country].filter(Boolean).join(", ");
  const showResults = query.trim().length >= 2;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Walk mode"
      title="Where do you want to start?"
      description="Your character appears there with the live weather. Anyone else walking shows up too."
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="walk-name" className="block text-[13px] font-medium text-ink mb-1.5">
            Your name <span className="font-normal text-ink-subtle">(shown to other walkers)</span>
          </label>
          <input
            id="walk-name"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            className="w-full h-11 px-3 rounded-lg border border-line bg-surface text-[14px] text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
          />
        </div>
        <button
          onClick={useGps}
          disabled={gps.status === "locating"}
          className="w-full min-h-14 rounded-xl border border-line bg-surface hover:bg-surface-2 px-4 flex items-center gap-3 text-left disabled:opacity-70"
        >
          {gps.status === "locating" ? (
            <span className="size-5 shrink-0 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
          ) : (
            <LocateFixed className="size-5 shrink-0 text-accent" />
          )}
          <span className="min-w-0">
            <span className="block text-[14px] font-medium text-ink">
              {gps.status === "locating" ? "Finding your location…" : "Use my current location"}
            </span>
            <span className="block text-[12.5px] text-ink-subtle">From your device&apos;s GPS</span>
          </span>
        </button>
        {gps.status === "error" && (
          <p role="alert" className="-mt-2 text-[12.5px] text-warn leading-snug">
            {gps.message}
          </p>
        )}

        <div className="flex items-center gap-3 text-[11.5px] text-ink-subtle uppercase tracking-wider">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>

        <div>
          <label htmlFor="walk-city" className="block text-[13px] font-medium text-ink mb-1.5">
            Or enter a city or town
          </label>
          <div className="relative">
            <Search className="size-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="walk-city"
              type="search"
              autoComplete="address-level2"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) setResults([]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  e.preventDefault();
                  const p = results[0];
                  go({ lat: p.latitude, lng: p.longitude, label: placeLabel(p) });
                }
              }}
              placeholder="e.g. Guwahati, Shimla, Chennai, London"
              className="w-full h-11 pl-9 pr-3 rounded-lg border border-line bg-surface text-[14px] text-ink focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
            />
          </div>

          {showResults && (
            <ul className="mt-2 flex flex-col gap-0.5" aria-live="polite" aria-busy={searching}>
              {searching && results.length === 0 && (
                <li className="px-3 py-2 text-[13px] text-ink-subtle">Searching…</li>
              )}
              {searchError && <li className="px-3 py-2 text-[13px] text-warn">{searchError}</li>}
              {!searching && !searchError && results.length === 0 && (
                <li className="px-3 py-2 text-[13px] text-ink-subtle">No places found.</li>
              )}
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => go({ lat: p.latitude, lng: p.longitude, label: placeLabel(p) })}
                    className="w-full min-h-11 px-3 py-2 rounded-lg hover:bg-surface-2 flex items-center gap-3 text-left"
                  >
                    <MapPin className="size-4 shrink-0 text-ink-subtle" />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-ink truncate">{p.name}</span>
                      <span className="block text-[12px] text-ink-subtle truncate">
                        {[p.region, p.country].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => go({ ...mapCentre(), label: "Map centre" })}
          className="self-start h-9 px-2 -ml-2 rounded-lg text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink flex items-center gap-2"
        >
          <Crosshair className="size-4" /> Start where the map is now
        </button>
      </div>
    </Dialog>
  );
}
