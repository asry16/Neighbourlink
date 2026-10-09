"use client";

import { useSyncExternalStore } from "react";

/**
 * Optional per-browser MapTiler key / style-URL override (diagnostics). The
 * deployed key comes from NEXT_PUBLIC_MAPTILER_API_KEY; this never changes it.
 */
const STORAGE_KEY = "neighbourlink_map_api_key";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setMapApiKeyOverride(value: string) {
  try {
    if (value.trim()) localStorage.setItem(STORAGE_KEY, value.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useMapApiKeyOverride(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => ""
  );
}
