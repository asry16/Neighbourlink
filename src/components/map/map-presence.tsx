"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { Ghost, Users } from "lucide-react";
import { usePresence } from "./use-presence";
import type { WalkerPose } from "./walker-3d";
import { avatarSVG, avatarSizePx } from "@/lib/avatar";
import { createSessionStore } from "@/lib/session-store";
import { esc } from "./marker-html";
import type { LiveLocation, LocationStatus } from "@/lib/use-live-location";
import type { Walker } from "@/lib/presence-types";

/** Snap-style "ghost mode": hidden unless you choose to be seen (per tab). */
const shareStore = createSessionStore<boolean>("neighbourlink_share_me", false, (v): v is boolean => typeof v === "boolean");

const M_PER_DEG = 111_320;
const distanceM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((b.lng - a.lng) * M_PER_DEG * Math.cos((a.lat * Math.PI) / 180), (b.lat - a.lat) * M_PER_DEG);

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

/** Avatar pin: round cartoon face, name underneath, optional ring / badge. */
function avatarPin(seed: string, color: string, name: string, opts: { self?: boolean; ghost?: boolean }) {
  const el = document.createElement("div");
  el.className = "nl-avatar-pin";
  el.innerHTML = `
    <div class="nl-avatar-face" style="--ring:${opts.self ? "var(--nl-accent)" : color}">
      ${avatarSVG(seed, color)}
      <span data-badge class="nl-avatar-badge hidden"></span>
    </div>
    <div class="nl-avatar-name">${esc(name)}</div>`;
  if (opts.ghost) el.classList.add("is-ghost");
  return el;
}

function setBadge(el: HTMLElement, text: string | null, danger = false) {
  const b = el.querySelector<HTMLElement>("[data-badge]");
  if (!b) return;
  if (b.dataset.value === (text ?? "")) return;
  b.dataset.value = text ?? "";
  b.textContent = text ?? "";
  b.classList.toggle("hidden", !text);
  b.classList.toggle("is-danger", danger);
}

/**
 * Everyone online as Snap Map-style avatars that scale with zoom. Your own
 * avatar follows your live GPS position; others see you only when you turn
 * on "Show me on the map".
 */
export function MapPresence({
  map,
  name,
  liveLocation,
  locationStatus,
  startLiveLocation,
}: {
  map: maplibregl.Map;
  name: string;
  liveLocation: LiveLocation | null;
  locationStatus: LocationStatus;
  startLiveLocation: () => void;
}) {
  const sharing = shareStore.use();
  const liveRef = useRef(liveLocation);
  const sharingRef = useRef(sharing);
  useEffect(() => {
    liveRef.current = liveLocation;
    sharingRef.current = sharing;
  }, [liveLocation, sharing]);

  // Publish only when sharing and we have a fix; otherwise stay a ghost.
  const getPose = useCallback((): WalkerPose | null => {
    const l = liveRef.current;
    if (!sharingRef.current || !l) return null;
    return { lat: l.lat, lng: l.lng, heading: l.heading ?? 0, gait: 0 };
  }, []);
  const presence = usePresence({ name, place: "Live location", getPose });
  const presenceRef = useRef(presence);
  useEffect(() => {
    presenceRef.current = presence;
  }, [presence]);

  const [open, setOpen] = useState(false);

  // Avatar size follows zoom through one CSS variable on the map container.
  useEffect(() => {
    const container = map.getContainer();
    const apply = () => {
      const zoom = map.getZoom();
      container.style.setProperty("--nl-avatar", `${avatarSizePx(zoom)}px`);
      container.classList.toggle("nl-avatars-compact", zoom < 8);
    };
    apply();
    map.on("zoom", apply);
    return () => {
      map.off("zoom", apply);
    };
  }, [map]);

  // My avatar at my real position (always shown to me, faded in ghost mode).
  const selfRef = useRef<{ marker: maplibregl.Marker; el: HTMLElement } | null>(null);
  useEffect(() => {
    if (!liveLocation || locationStatus !== "active") {
      selfRef.current?.marker.remove();
      selfRef.current = null;
      return;
    }
    if (!selfRef.current) {
      const el = avatarPin(presence.myId, presence.myColor, "You", { self: true, ghost: !sharing });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -14] })
        .setLngLat([liveLocation.lng, liveLocation.lat])
        .addTo(map);
      selfRef.current = { marker, el };
    }
    selfRef.current.marker.setLngLat([liveLocation.lng, liveLocation.lat]);
    selfRef.current.el.classList.toggle("is-ghost", !sharing);
    setBadge(selfRef.current.el, sharing ? null : "👻");
  }, [map, liveLocation, locationStatus, sharing, presence.myId, presence.myColor]);
  useEffect(
    () => () => {
      selfRef.current?.marker.remove();
    },
    []
  );

  // Everyone else: glide toward their latest position every frame.
  useEffect(() => {
    const pins = new Map<string, { marker: maplibregl.Marker; el: HTMLElement; lat: number; lng: number }>();
    let frame = 0;
    let last = performance.now();

    const popupFor = (w: Walker) => {
      const me = liveRef.current;
      const away = me ? ` · ${formatDistance(distanceM(me, w))} away` : "";
      const where = w.place === "Live location" ? "Sharing live location" : `Walking in ${w.place || "3D walk mode"}`;
      return new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
        `<div class="px-3 py-2 font-sans"><div class="text-[13.5px] font-semibold text-ink">${esc(w.name)}</div>` +
          `<div class="text-[12px] text-ink-subtle">${esc(where)}${esc(away)}</div></div>`
      );
    };

    const tick = (now: number) => {
      const k = 1 - Math.exp(-Math.min((now - last) / 1000, 0.1) * 6);
      last = now;
      const p = presenceRef.current;
      const others = p.othersRef.current;
      for (const [id, w] of others) {
        let pin = pins.get(id);
        if (!pin) {
          const el = avatarPin(id, w.color, w.name, {});
          const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([w.lng, w.lat])
            .addTo(map);
          pin = { marker, el, lat: w.lat, lng: w.lng };
          pins.set(id, pin);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const cur = presenceRef.current.othersRef.current.get(id);
            if (cur) marker.setPopup(popupFor(cur)).togglePopup();
          });
        }
        // Snap across big jumps (a walker teleporting to another city).
        const far = distanceM(pin, w) > 2000;
        pin.lat = far ? w.lat : pin.lat + (w.lat - pin.lat) * k;
        pin.lng = far ? w.lng : pin.lng + (w.lng - pin.lng) * k;
        pin.marker.setLngLat([pin.lng, pin.lat]);
        const help = w.emote === "help" && p.emoteActive(w);
        setBadge(pin.el, help ? "🆘" : p.emoteActive(w) && w.emote === "wave" ? "👋" : p.emoteActive(w) && w.emote === "thanks" ? "🙏" : null, help);
        pin.el.classList.toggle("is-help", help);
      }
      for (const [id, pin] of pins) {
        if (others.has(id)) continue;
        pin.marker.remove();
        pins.delete(id);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      pins.forEach((pin) => pin.marker.remove());
    };
  }, [map]);

  const toggleSharing = () => {
    const next = !sharing;
    shareStore.set(next);
    if (next && locationStatus !== "active" && locationStatus !== "requesting") startLiveLocation();
  };

  const count = presence.others.length;
  const nearby = liveLocation
    ? presence.others.filter((w) => distanceM(liveLocation, w) < 10_000).length
    : null;

  return (
    <div className="nl-glass rounded-xl pointer-events-auto animate-rise">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="min-h-11 md:min-h-9 px-3 flex items-center gap-2 text-[12.5px] text-ink"
      >
        <span className={`size-1.5 rounded-full ${presence.connected ? "bg-ok" : "bg-warn"}`} />
        <Users className="size-3.5 text-ink-muted" />
        <span className="font-medium">
          {count} online{nearby != null && count > 0 ? ` · ${nearby} near you` : ""}
        </span>
        {!sharing && <Ghost className="size-3.5 text-ink-subtle" aria-label="You are hidden" />}
      </button>
      {open && (
        <div className="px-3 pb-3 w-[min(18rem,calc(100vw-7rem))]">
          <label className="flex items-start gap-3 py-2 cursor-pointer">
            <span className="relative mt-0.5 shrink-0">
              <input type="checkbox" checked={sharing} onChange={toggleSharing} className="peer sr-only" />
              <span className="block w-9 h-5 rounded-full bg-surface-3 peer-checked:bg-accent transition-colors" />
              <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
            <span className="text-[12.5px] leading-snug">
              <span className="block font-medium text-ink">Show me on the map</span>
              <span className="block text-ink-subtle">
                {sharing
                  ? "Everyone using Neighbourlink can see your live location. Turn off anytime."
                  : "Ghost mode: you can see others, but no one can see you."}
              </span>
            </span>
          </label>
          {sharing && locationStatus !== "active" && (
            <p className="text-[12px] text-warn">
              {locationStatus === "requesting" ? "Finding your location…" : "Turn on location to appear on the map."}
            </p>
          )}
          {count === 0 && (
            <p className="mt-1 text-[12px] text-ink-subtle">
              No one else is online right now. Share the link, or open it in another window to try it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
