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
  /** Current pose to share, or null to stay hidden (ghost mode / no fix). */
  getPose: () => WalkerPose | null;
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
  /** A call for help stays up until cancelled, unlike a wave. */
  const [askingHelp, setAskingHelp] = useState(false);
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
    let visible = false;
    const leave = () => {
      try {
        navigator.sendBeacon?.("/api/presence/leave", JSON.stringify({ id: myId }));
      } catch {
        /* the server drops stale walkers anyway */
      }
    };
    const timer = setInterval(() => {
      if (inFlight) return;
      const pose = getPoseRef.current();
      if (!pose) {
        // Went hidden: tell the server now rather than waiting to go stale.
        if (visible) {
          visible = false;
          last = null;
          leave();
        }
        return;
      }
      visible = true;
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
    // "help" toggles: pressing it again cancels the call.
    if (e === "help" && cur.emote === "help") {
      emoteRef.current = { emote: null, seq: cur.seq + 1, until: 0 };
      setAskingHelp(false);
      setMyEmote(null);
    } else {
      const until = e === "help" ? Number.POSITIVE_INFINITY : Date.now() + EMOTE_MS;
      emoteRef.current = { emote: e, seq: cur.seq + 1, until };
      setAskingHelp(e === "help");
      setMyEmote({ emote: e, seq: cur.seq + 1 });
    }
    forceSend.current = true;
  }, []);

  /** Whether a walker's emote is still showing (a help call lasts until cancelled). */
  const emoteActive = useCallback(
    (w: Walker) =>
      !!w.emote && (w.emote === "help" || Date.now() + clockOffsetRef.current - w.emoteAt < EMOTE_MS),
    []
  );

  return { myId, myColor, others, othersRef, connected, emote, myEmote, askingHelp, emoteActive };
}
