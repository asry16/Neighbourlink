import type { Emote, Walker, WalkerUpdate } from "@/lib/presence-types";

/** Walkers not heard from for this long have left. */
const STALE_MS = 12_000;
const MAX_WALKERS = 300;
const EMOTES: Emote[] = ["wave", "help", "thanks"];

type Listener = (walkers: Walker[]) => void;

interface PresenceState {
  walkers: Map<string, Walker>;
  listeners: Set<Listener>;
  version: number;
}

// Kept on globalThis so dev hot-reloads don't drop everyone. In-memory: one
// server process holds the room (fine for a single instance / demo).
const g = globalThis as unknown as { __nlPresence?: PresenceState };
const state: PresenceState = (g.__nlPresence ??= { walkers: new Map(), listeners: new Set(), version: 0 });

const finite = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

function clean(text: unknown, max: number, fallback: string) {
  const s = typeof text === "string" ? text.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : "";
  return s || fallback;
}

function prune(now = Date.now()) {
  let changed = false;
  for (const [id, w] of state.walkers) {
    if (now - w.updatedAt > STALE_MS) {
      state.walkers.delete(id);
      changed = true;
    }
  }
  return changed;
}

function notify() {
  state.version++;
  const list = [...state.walkers.values()];
  state.listeners.forEach((l) => l(list));
}

export class PresenceService {
  /** Validate and store a walker's latest pose. Returns false if rejected. */
  static upsert(input: Partial<WalkerUpdate>): boolean {
    if (typeof input.id !== "string" || !/^[a-z0-9-]{8,64}$/i.test(input.id)) return false;
    if (!finite(input.lat, -85, 85) || !finite(input.lng, -180, 180)) return false;
    const now = Date.now();
    prune(now);
    const prev = state.walkers.get(input.id);
    if (!prev && state.walkers.size >= MAX_WALKERS) return false;

    const emote = input.emote && EMOTES.includes(input.emote) ? input.emote : null;
    const emoteSeq = finite(input.emoteSeq, 0, Number.MAX_SAFE_INTEGER) ? (input.emoteSeq as number) : 0;
    const newEmote = !!emote && emoteSeq !== (prev?.emoteSeq ?? 0);
    state.walkers.set(input.id, {
      id: input.id,
      name: clean(input.name, 24, "Walker"),
      color: typeof input.color === "string" && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#2a9d8f",
      lat: input.lat as number,
      lng: input.lng as number,
      heading: finite(input.heading, -360, 720) ? (input.heading as number) : 0,
      gait: finite(input.gait, -3, 3) ? (input.gait as number) : 0,
      place: clean(input.place, 60, ""),
      emote,
      emoteSeq,
      // A new sequence number starts a fresh emote; otherwise keep its start.
      emoteAt: newEmote ? now : (prev?.emoteAt ?? 0),
      updatedAt: now,
    });
    notify();
    return true;
  }

  static leave(id: string) {
    if (state.walkers.delete(id)) notify();
  }

  static list(): Walker[] {
    if (prune()) notify();
    return [...state.walkers.values()];
  }

  /** Called on every change; returns an unsubscribe function. */
  static subscribe(listener: Listener) {
    state.listeners.add(listener);
    return () => state.listeners.delete(listener);
  }
}
