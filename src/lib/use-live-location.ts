"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveLocation {
  lat: number;
  lng: number;
  /** 68% confidence radius in metres, as reported by the device. */
  accuracy: number;
  /** Degrees clockwise from north; null when stationary or unsupported. */
  heading: number | null;
  timestamp: number;
}

export type LocationStatus = "off" | "requesting" | "active" | "denied" | "unavailable";

/**
 * Continuous device location via `watchPosition`. Nothing is requested until
 * `start()` is called, so the permission prompt only appears on user action.
 */
export function useLiveLocation() {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setStatus("off");
    setLocation(null);
    setError(null);
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("This browser doesn't support location.");
      return;
    }
    if (watchId.current !== null) return;

    setStatus("requesting");
    setError(null);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          timestamp: pos.timestamp,
        });
        setStatus("active");
        setError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          // Permanent until the user changes browser settings — stop watching.
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
          setLocation(null);
          setStatus("denied");
          setError("Location access is blocked. Allow it in your browser's site settings.");
        } else {
          // Timeouts / signal loss are transient: keep watching, keep last fix.
          setStatus((s) => (s === "active" ? "active" : "unavailable"));
          setError("Can't get a location fix right now. Still trying…");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
  }, []);

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    []
  );

  return { location, status, error, start, stop };
}

/** "±12 m" / "±1.4 km" */
export const formatAccuracy = (m: number) =>
  m < 1000 ? `±${Math.round(m)} m` : `±${(m / 1000).toFixed(1)} km`;
