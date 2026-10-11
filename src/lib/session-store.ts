"use client";

import { useSyncExternalStore } from "react";

/**
 * A value kept in sessionStorage (survives reloads, not new tabs) and shared
 * by every component that reads it. Falls back cleanly when storage is
 * unavailable or holds something invalid.
 */
export function createSessionStore<T>(key: string, fallback: T, isValid: (v: unknown) => v is T) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } = { raw: null, value: fallback };

  const read = (): T => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch {
      return fallback;
    }
    // Same string → same object, as useSyncExternalStore requires.
    if (raw === cache.raw) return cache.value;
    let value = fallback;
    try {
      const parsed = raw == null ? null : JSON.parse(raw);
      if (isValid(parsed)) value = parsed;
    } catch {
      /* keep fallback */
    }
    cache = { raw, value };
    return value;
  };

  const set = (next: T | ((prev: T) => T)) => {
    const value = typeof next === "function" ? (next as (prev: T) => T)(read()) : next;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: still notify so the UI updates this session */
      cache = { raw: JSON.stringify(value), value };
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };

  const use = () => useSyncExternalStore(subscribe, read, () => fallback);
  return { use, set };
}
