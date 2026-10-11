"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Small per-device preferences in localStorage, hydration-safe (server and
 * first client render use the default). Not synced to the account.
 */
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    /* storage unavailable */
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  try {
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    /* corrupt — fallback */
  }
  cache.set(key, { raw, value });
  return value;
}

export function useLocalPref<T>(key: string, fallback: T): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(key, fallback),
    () => fallback
  );
  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      listeners.forEach((l) => l());
    },
    [key]
  );
  return [value, set];
}

export const SAVED_AREAS_KEY = "neighbourlink_saved_areas";
export const NOTIFY_PREFS_KEY = "neighbourlink_notification_prefs";

export interface NotificationPrefs {
  SOS_UPDATE: boolean;
  SOS_DISPATCH: boolean;
  HAZARD_ALERT: boolean;
  CORROBORATION: boolean;
}

export const DEFAULT_NOTIFY_PREFS: NotificationPrefs = {
  SOS_UPDATE: true,
  SOS_DISPATCH: true,
  HAZARD_ALERT: true,
  CORROBORATION: true,
};
