"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  colorFor,
  EMOTE_MS,
  type Emote,
  type PresenceSnapshot,
  type Walker,
  type WalkerUpdate,
} from "@/lib/presence-types";
import type { WalkerPose } from "./walker-3d";

const SEND_EVERY_MS = 150;
/** Idle walkers still check in so others don't think they left. */
const HEARTBEAT_MS = 2000;
const UI_REFRESH_MS = 500;

/** One id per browser tab, so two windows are two walkers. */
function tabWalkerId(): string {
  const make = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `w-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  try {
    const existing = sessionStorage.getItem("nl-walker-id");
    if (existing) return existing;
    const id = make();
    sessionStorage.setItem("nl-walker-id", id);
    return id;
  } catch {
    return make();
  }
}

/**
 * Shared walk: publishes this walker's pose and streams everyone else's.
 * `othersRef` is read every animation frame; `others` is a throttled copy
 * for the UI.
 */
export function usePresence({
  name,
  place,
  getPose,
}: {
  name: string;
  place: string;
  getPose: () => WalkerPose;
}) {
  const [myId] = useState(tabWalkerId);
  const myColor = colorFor(myId);
  const othersRef = useRef(new Map<string, Walker>());
  /** serverNow − Date.now(), to age emotes on the server's clock. */
  const clockOffsetRef = useRef(0);
  const [others, setOthers] = useState<Walker[]>([]);
  const [connected, setConnected] = useState(false);
  const emoteRef = useRef<{ emote: Emote | null; seq: number; until: number }>({ emote: null, seq: 0, until: 0 });
  const [myEmote, setMyEmote] = useState<{ emote: Emote; seq: number } | null>(null);
  const forceSend = useRef(false);
  const identity = useRef({ name, place });
  const getPoseRef = useRef(getPose);
  useEffect(() => {
    identity.current = { name, place };
    getPoseRef.current = getPose;
  }, [name, place, getPose]);

  // Publish: on change, plus a heartbeat while standing still.
  useEffect(() => {
    let inFlight = false;
    let lastSent = 0;
    let last: WalkerPose | null = null;
    const timer = setInterval(() => {
      if (inFlight) return;
      const pose = getPoseRef.current();
      const now = Date.now();
      const e = emoteRef.current;
      if (e.emote && now > e.until) e.emote = null;
      const changed =
        !last ||
        Math.abs(pose.lat - last.lat) > 3e-6 ||
        Math.abs(pose.lng - last.lng) > 3e-6 ||
        Math.abs(pose.heading - last.heading) > 2 ||
        pose.gait !== last.gait;
      if (!changed && !forceSend.current && now - lastSent < HEARTBEAT_MS) return;

      const update: WalkerUpdate = {
        id: myId,
        name: identity.current.name,
        color: myColor,
        place: identity.current.place,
        ...pose,
        emote: e.emote,
        emoteSeq: e.seq,
      };
      inFlight = true;
      forceSend.current = false;
      last = pose;
      lastSent = now;
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
        keepalive: true,
      })
        .catch(() => {
          /* the next tick retries */
        })
        .finally(() => {
          inFlight = false;
        });
    }, SEND_EVERY_MS);

    const leave = () => {
      try {
        navigator.sendBeacon?.("/api/presence/leave", JSON.stringify({ id: myId }));
      } catch {
        /* the server drops stale walkers anyway */
      }
    };
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [myId, myColor]);

  // Subscribe to everyone else.
  useEffect(() => {
    const source = new EventSource("/api/presence/stream");
    let lastUi = 0;
    let lastCount = -1;
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (msg) => {
      try {
        const snap: PresenceSnapshot = JSON.parse(msg.data);
        clockOffsetRef.current = snap.serverNow - Date.now();
        const map = new Map<string, Walker>();
        for (const w of snap.walkers) if (w.id !== myId) map.set(w.id, w);
        othersRef.current = map;
        const now = Date.now();
        if (map.size !== lastCount || now - lastUi > UI_REFRESH_MS) {
          lastUi = now;
          lastCount = map.size;
          setOthers([...map.values()]);
        }
        setConnected(true);
      } catch {
        /* ignore a malformed frame */
      }
    };
    return () => source.close();
  }, [myId]);

  const emote = useCallback((e: Emote) => {
    const cur = emoteRef.current;
    emoteRef.current = { emote: e, seq: cur.seq + 1, until: Date.now() + EMOTE_MS };
    forceSend.current = true;
    setMyEmote({ emote: e, seq: cur.seq + 1 });
  }, []);

  /** Whether a walker's emote is still showing. */
  const emoteActive = useCallback(
    (w: Walker) => !!w.emote && Date.now() + clockOffsetRef.current - w.emoteAt < EMOTE_MS,
    []
  );

  return { myId, myColor, others, othersRef, connected, emote, myEmote, emoteActive };
}
