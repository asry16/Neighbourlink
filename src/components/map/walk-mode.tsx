"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import {
  ArrowBigDown,
  ArrowBigLeft,
  ArrowBigRight,
  ArrowBigUp,
  AlertTriangle,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  RefreshCw,
  Sun,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { createCrowd3D, WALKER_LAYER_ID, type Crowd3D, type WalkerPose } from "./walker-3d";
import { usePresence } from "./use-presence";
import { EMOTE_LABEL, EMOTE_MS, type Emote, type Walker } from "@/lib/presence-types";
import { WeatherOverlay } from "./weather-overlay";
import type { WalkStart } from "./walk-start-dialog";
import { aqiPresentation, AQI_SCALE_LABEL, smogLevel } from "@/lib/air-quality";
import type { LocalConditions } from "@/lib/live-types";
import {
  compassPoint,
  skyFor,
  weatherLabel,
  weatherScene,
  WEATHER_PREVIEWS,
  type CurrentWeather,
} from "@/lib/weather";

/** Something on the map the walker can come close to. */
export interface WalkPoi {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "report" | "sos" | "official" | "help";
}

type Dir = "forward" | "back" | "left" | "right";

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "forward",
  KeyW: "forward",
  ArrowDown: "back",
  KeyS: "back",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

/** Sped up from real walking pace so a demo can cover a neighbourhood. */
const WALK_SPEED_MPS = 25;
const RUN_MULTIPLIER = 3;
const TURN_DEG_PER_S = 110;
const WALK_ZOOM = 17.6;
const WALK_PITCH = 66;
const ALERT_RADIUS_M = 150;
const M_PER_DEG_LAT = 111_320;
const WEATHER_REFRESH_MS = 5 * 60 * 1000;
/** ~2 km cells, about the resolution of Open-Meteo's models. Entering a new
 * cell fetches the weather there. */
const WEATHER_CELL_DEG = 0.02;
const weatherCell = (p: { lat: number; lng: number }) =>
  `${Math.round(p.lat / WEATHER_CELL_DEG)}:${Math.round(p.lng / WEATHER_CELL_DEG)}`;

const KIND_LABEL: Record<WalkPoi["kind"], string> = {
  report: "Community report",
  sos: "SOS area",
  official: "Official warning",
  help: "Help centre",
};

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const x = (bLng - aLng) * M_PER_DEG_LAT * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const y = (bLat - aLat) * M_PER_DEG_LAT;
  return Math.hypot(x, y);
}

/** Compass bearing (0 = north, clockwise) from a to b. */
function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number) {
  const x = (bLng - aLng) * Math.cos(aLat * (Math.PI / 180));
  const y = bLat - aLat;
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function relativeDirection(heading: number, target: number) {
  const delta = ((target - heading + 540) % 360) - 180;
  if (Math.abs(delta) <= 50) return "ahead";
  if (Math.abs(delta) >= 130) return "behind";
  return delta > 0 ? "to your right" : "to your left";
}

function weatherIconFor(w: CurrentWeather): LucideIcon {
  const c = w.weatherCode;
  if (c >= 95) return CloudLightning;
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return CloudRain;
  if (c >= 51 && c <= 57) return CloudDrizzle;
  if (c >= 71 && c <= 86) return CloudSnow;
  if (c === 45 || c === 48) return CloudFog;
  if (c === 3) return Cloud;
  if (c === 1 || c === 2) return w.isDay ? CloudSun : CloudMoon;
  return w.isDay ? Sun : Moon;
}

interface Nearby {
  poi: WalkPoi;
  distance: number;
  direction: string;
}

interface HelpCall {
  walker: Walker;
  distance: number;
  direction: string;
  bearing: number;
}

/** Walkers within this distance count as "here" and can see your SOS. */
const NEARBY_WALKERS_M = 5000;
const HELP_RADIUS_M = 3000;
const SELF_ID = "self";
const EMOTE_KEYS: Record<string, Emote> = { Digit1: "wave", Digit2: "thanks", Digit3: "help" };

/** Floating name tag (and emote bubble) above a character. */
function nameTag(name: string, color: string, isSelf: boolean) {
  const el = document.createElement("div");
  el.className = "pointer-events-none flex flex-col items-center gap-1";
  el.innerHTML = `
    <div data-emote class="hidden px-2.5 py-1 rounded-full bg-white text-[13px] font-semibold text-neutral-900 shadow-lg whitespace-nowrap"></div>
    <div class="flex items-center gap-1.5 h-6 pl-1.5 pr-2 rounded-full bg-black/65 text-white text-[11.5px] font-medium shadow whitespace-nowrap backdrop-blur-sm">
      <span class="size-2.5 rounded-full" style="background:${color}"></span><span data-name></span>
    </div>`;
  (el.querySelector("[data-name]") as HTMLElement).textContent = isSelf ? `${name} (you)` : name;
  return el;
}

function setTagEmote(el: HTMLElement, emote: Emote | null) {
  const bubble = el.querySelector<HTMLElement>("[data-emote]");
  if (!bubble) return;
  const next = emote ? `${EMOTE_LABEL[emote].icon} ${EMOTE_LABEL[emote].text}` : "";
  if (bubble.dataset.value === next) return;
  bubble.dataset.value = next;
  bubble.textContent = next;
  bubble.classList.toggle("hidden", !emote);
  bubble.classList.toggle("!bg-red-600", emote === "help");
  bubble.classList.toggle("!text-white", emote === "help");
}

/**
 * Third-person walking with a 3D character and live local weather. The
 * character stays centred while the camera follows behind; up/down walk,
 * left/right turn. Real rain at the walker's position is drawn over the map.
 */
export function WalkMode({
  map,
  start,
  pois,
  onExit,
  onOpenDetails,
}: {
  map: maplibregl.Map;
  start: WalkStart;
  pois: WalkPoi[];
  onExit: () => void;
  onOpenDetails: (id: string) => void;
}) {
  const held = useRef(new Set<Dir>());
  const running = useRef(false);
  const posRef = useRef({ lat: start.lat, lng: start.lng });
  const headingRef = useRef(map.getBearing());
  const poisRef = useRef(pois);
  const crowdRef = useRef<Crowd3D | null>(null);
  const gaitRef = useRef(0);
  const getPose = useCallback(
    (): WalkerPose => ({ ...posRef.current, heading: headingRef.current, gait: gaitRef.current }),
    []
  );
  const presence = usePresence({ name: start.name, place: start.label, getPose });
  const presenceRef = useRef(presence);
  useEffect(() => {
    presenceRef.current = presence;
  }, [presence]);
  const [helpCall, setHelpCall] = useState<HelpCall | null>(null);
  /** Throttled copy of the position for rendering distances. */
  const [myPos, setMyPos] = useState({ lat: start.lat, lng: start.lng });
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [walkedM, setWalkedM] = useState(0);
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [pressed, setPressed] = useState<Set<Dir>>(new Set());
  const [loading3D, setLoading3D] = useState(true);
  const getBearing = useCallback(() => map.getBearing(), [map]);

  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"loading" | "ok" | "error">("loading");
  const [updatingWeather, setUpdatingWeather] = useState(false);
  const [conditions, setConditions] = useState<LocalConditions | null>(null);
  const [preview, setPreview] = useState<keyof typeof WEATHER_PREVIEWS | "live">("live");
  const weatherCellRef = useRef(weatherCell(start));
  const weatherInFlight = useRef(false);

  useEffect(() => {
    poisRef.current = pois;
  }, [pois]);

  const fetchWeather = useCallback(async (at: { lat: number; lng: number }) => {
    if (weatherInFlight.current) return;
    weatherInFlight.current = true;
    weatherCellRef.current = weatherCell(at);
    setUpdatingWeather(true);
    try {
      const q = `lat=${at.lat.toFixed(4)}&lng=${at.lng.toFixed(4)}`;
      // Air quality and flood risk are extras; weather alone is enough to show.
      const [res, cond] = await Promise.all([
        fetch(`/api/weather?${q}`),
        fetch(`/api/conditions?${q}`).then((r) => r.json()).catch(() => null),
      ]);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setWeather(json.data);
      setWeatherStatus("ok");
      if (cond?.success) setConditions(cond.data);
    } catch {
      setWeatherStatus((s) => (s === "ok" ? "ok" : "error"));
    } finally {
      weatherInFlight.current = false;
      setUpdatingWeather(false);
      // The walker may have crossed into another cell while this was loading.
      if (weatherCell(posRef.current) !== weatherCellRef.current) void fetchWeatherRef.current(posRef.current);
    }
  }, []);
  const fetchWeatherRef = useRef(fetchWeather);
  useEffect(() => {
    fetchWeatherRef.current = fetchWeather;
  }, [fetchWeather]);

  // Live weather: on spawn, then every few minutes for wherever the walker is.
  useEffect(() => {
    void fetchWeatherRef.current(start);
    const id = setInterval(() => void fetchWeatherRef.current(posRef.current), WEATHER_REFRESH_MS);
    return () => clearInterval(id);
    // Spawn point only; later positions come from posRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A preview overlays demo conditions on the live reading; it is always labelled.
  const shown = useMemo<CurrentWeather | null>(
    () => (preview === "live" || !weather ? weather : { ...weather, ...WEATHER_PREVIEWS[preview].weather }),
    [weather, preview]
  );
  const scene = useMemo(() => (shown ? weatherScene(shown) : null), [shown]);
  const sceneRef = useRef(scene);
  const aq = conditions?.airQuality ?? null;
  // The smog preview simulates a Severe-AQI day (labelled as a preview).
  const smog = preview === "smog" ? smogLevel("Severe") : aq ? aqiPresentation(aq.scale, aq.category).smog : 0;
  const masked = smog >= 0.35;
  const maskedRef = useRef(masked);
  const flood = conditions?.floodRisk ?? null;

  // Character outfit / lighting and the map's sky follow the weather.
  useEffect(() => {
    sceneRef.current = scene;
    if (!scene) return;
    const daylight = scene.isDay
      ? Math.max(0.3, 1 - scene.cloudCover * 0.4 - (scene.precip === "none" ? 0 : 0.2) - scene.fog * 0.2)
      : 0.12;
    maskedRef.current = masked;
    crowdRef.current?.setWeather({ precip: scene.precip, daylight: daylight * (1 - smog * 0.3), mask: masked });
    map.setSky(skyFor(scene));
  }, [scene, map, smog, masked]);

  // 3D character, camera and movement loop live for the whole walk.
  useEffect(() => {
    let cancelled = false;
    const originalSky = map.getSky();
    const addLayer = () => {
      const w = crowdRef.current;
      if (w && !map.getLayer(WALKER_LAYER_ID)) map.addLayer(w.layer);
      if (sceneRef.current) map.setSky(skyFor(sceneRef.current));
    };

    // Name tags for you and everyone else; positions follow the 3D figures.
    const tags = new Map<string, { marker: maplibregl.Marker; el: HTMLElement }>();
    const tagFor = (id: string, name: string, color: string, isSelf: boolean) => {
      let t = tags.get(id);
      if (!t) {
        const el = nameTag(name, color, isSelf);
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -96] })
          .setLngLat([posRef.current.lng, posRef.current.lat])
          .addTo(map);
        t = { marker, el };
        tags.set(id, t);
      }
      return t;
    };
    // Others glide toward their latest reported pose between updates.
    const shown = new Map<string, WalkerPose>();

    void createCrowd3D(map).then((w) => {
      if (cancelled) {
        w.dispose();
        return;
      }
      crowdRef.current = w;
      const sc = sceneRef.current;
      if (sc)
        w.setWeather({
          precip: sc.precip,
          daylight: sc.isDay ? 1 - sc.cloudCover * 0.4 : 0.12,
          mask: maskedRef.current,
        });
      addLayer();
      setLoading3D(false);
    });
    // A theme / basemap switch replaces the style and drops custom layers.
    map.on("style.load", addLayer);

    // Arrow keys belong to the walker now, and dragging would leave it off-centre.
    map.keyboard.disable();
    map.dragPan.disable();
    // Fly when the start is far away (e.g. another city), ease when it's close.
    const c = map.getCenter();
    const far = distanceM(c.lat, c.lng, start.lat, start.lng) > 30_000;
    map.flyTo({
      center: [start.lng, start.lat],
      zoom: WALK_ZOOM,
      pitch: WALK_PITCH,
      bearing: headingRef.current,
      duration: far ? 3500 : 900,
      essential: true,
    });

    let frame = 0;
    let last = performance.now();
    let wasMoving = false;
    let walked = 0;
    let lastReport = 0;
    let lastNearbyKey = "";
    let lastHelpKey = "";
    let lastMineSeq = 0;
    let mineSince = -Infinity;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const dirs = held.current;
      const turn = (dirs.has("right") ? 1 : 0) - (dirs.has("left") ? 1 : 0);
      const step = (dirs.has("forward") ? 1 : 0) - (dirs.has("back") ? 1 : 0);
      const isMoving = step !== 0 || turn !== 0;
      const runFactor = running.current ? RUN_MULTIPLIER : 1;

      if (isMoving) {
        headingRef.current = (headingRef.current + turn * TURN_DEG_PER_S * dt + 360) % 360;
        const metres = step * WALK_SPEED_MPS * runFactor * dt;
        const rad = (headingRef.current * Math.PI) / 180;
        const { lat, lng } = posRef.current;
        posRef.current = {
          lat: lat + (metres * Math.cos(rad)) / M_PER_DEG_LAT,
          lng: lng + (metres * Math.sin(rad)) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)),
        };
        walked += Math.abs(metres);
        map.jumpTo({ center: [posRef.current.lng, posRef.current.lat], bearing: headingRef.current });
      }

      // Turning on the spot shuffles the feet; running swings harder.
      const gait = step !== 0 ? step * (running.current ? 2 : 1) : turn !== 0 ? 0.5 : 0;
      gaitRef.current = gait;
      const p = presenceRef.current;
      const crowd = crowdRef.current;
      crowd?.upsert(SELF_ID, { ...posRef.current, heading: headingRef.current, gait }, p.myColor);
      const selfTag = tagFor(SELF_ID, start.name, p.myColor, true);
      selfTag.marker.setLngLat([posRef.current.lng, posRef.current.lat]);
      const mine = p.myEmote;
      setTagEmote(selfTag.el, mine && performance.now() - mineSince < EMOTE_MS ? mine.emote : null);
      if (mine && mine.seq !== lastMineSeq) {
        lastMineSeq = mine.seq;
        mineSince = performance.now();
      }

      // Other walkers: smooth toward the latest pose, drop those who left.
      const k = 1 - Math.exp(-dt * 8);
      const others = p.othersRef.current;
      for (const [id, w] of others) {
        const prev = shown.get(id);
        const target: WalkerPose = { lat: w.lat, lng: w.lng, heading: w.heading, gait: w.gait };
        // Snap if they jumped far (new city) instead of sliding across the map.
        const pose =
          !prev || distanceM(prev.lat, prev.lng, w.lat, w.lng) > 2000
            ? target
            : {
                lat: prev.lat + (w.lat - prev.lat) * k,
                lng: prev.lng + (w.lng - prev.lng) * k,
                heading: prev.heading + ((((w.heading - prev.heading + 540) % 360) - 180) * k),
                gait: w.gait,
              };
        shown.set(id, pose);
        crowd?.upsert(id, pose, w.color);
        const tag = tagFor(id, w.name, w.color, false);
        tag.marker.setLngLat([pose.lng, pose.lat]);
        setTagEmote(tag.el, p.emoteActive(w) ? w.emote : null);
      }
      for (const id of [...shown.keys()]) {
        if (others.has(id)) continue;
        shown.delete(id);
        crowd?.remove(id);
        tags.get(id)?.marker.remove();
        tags.delete(id);
      }

      if (isMoving !== wasMoving) {
        wasMoving = isMoving;
        setMoving(isMoving);
      }

      // Distance, proximity and weather checks don't need 60 fps.
      if (now - lastReport > 250) {
        lastReport = now;
        setWalkedM(Math.round(walked));
        const { lat, lng } = posRef.current;
        setMyPos((prev) => (prev.lat === lat && prev.lng === lng ? prev : { lat, lng }));

        if (weatherCell(posRef.current) !== weatherCellRef.current) void fetchWeatherRef.current(posRef.current);

        let best: Nearby | null = null;
        for (const poi of poisRef.current) {
          const d = distanceM(lat, lng, poi.lat, poi.lng);
          if (d <= ALERT_RADIUS_M && (!best || d < best.distance)) {
            best = {
              poi,
              distance: d,
              direction: relativeDirection(headingRef.current, bearingDeg(lat, lng, poi.lat, poi.lng)),
            };
          }
        }
        const key = best ? `${best.poi.id}|${Math.round(best.distance / 10)}|${best.direction}` : "";
        if (key !== lastNearbyKey) {
          lastNearbyKey = key;
          setNearby(best);
        }

        // Someone close by asking for help takes priority.
        let help: HelpCall | null = null;
        for (const w of p.othersRef.current.values()) {
          if (w.emote !== "help" || !p.emoteActive(w)) continue;
          const d = distanceM(lat, lng, w.lat, w.lng);
          if (d <= HELP_RADIUS_M && (!help || d < help.distance)) {
            const b = bearingDeg(lat, lng, w.lat, w.lng);
            help = { walker: w, distance: d, bearing: b, direction: relativeDirection(headingRef.current, b) };
          }
        }
        const helpKey = help ? `${help.walker.id}|${Math.round(help.distance / 20)}|${help.direction}` : "";
        if (helpKey !== lastHelpKey) {
          lastHelpKey = helpKey;
          setHelpCall(help);
        }
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      map.off("style.load", addLayer);
      if (map.getLayer(WALKER_LAYER_ID)) map.removeLayer(WALKER_LAYER_ID);
      crowdRef.current?.dispose();
      crowdRef.current = null;
      tags.forEach((t) => t.marker.remove());
      map.keyboard.enable();
      map.dragPan.enable();
      map.setSky(originalSky ?? {});
    };
    // Mounted once per walk; `start` is the spawn point only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Keyboard: arrows / WASD, Shift to run, Escape to stop.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
    const sync = () => setPressed(new Set(held.current));

    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      running.current = e.shiftKey;
      if (e.key === "Escape") {
        onExit();
        return;
      }
      const emote = EMOTE_KEYS[e.code];
      if (emote && !e.repeat) {
        presenceRef.current.emote(emote);
        return;
      }
      const dir = KEY_DIR[e.code];
      if (!dir) return;
      e.preventDefault();
      held.current.add(dir);
      sync();
    };
    const up = (e: KeyboardEvent) => {
      running.current = e.shiftKey;
      const dir = KEY_DIR[e.code];
      if (!dir) return;
      held.current.delete(dir);
      sync();
    };
    const release = () => {
      held.current.clear();
      sync();
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, [onExit]);

  const press = (dir: Dir, on: boolean) => {
    if (on) held.current.add(dir);
    else held.current.delete(dir);
    setPressed(new Set(held.current));
  };

  const padButton = (dir: Dir, label: string, Icon: LucideIcon, area: string) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        press(dir, true);
      }}
      onPointerUp={() => press(dir, false)}
      onPointerCancel={() => press(dir, false)}
      onLostPointerCapture={() => press(dir, false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`${area} size-14 md:size-12 grid place-items-center rounded-xl touch-none transition-colors ${
        pressed.has(dir) ? "bg-accent text-canvas" : "text-ink hover:bg-surface-2"
      }`}
    >
      <Icon className="size-6" fill="currentColor" strokeWidth={1.5} />
    </button>
  );

  // Who's around, nearest first (refreshed with the throttled presence list).
  const here = presence.others
    .map((w) => ({ w, d: distanceM(myPos.lat, myPos.lng, w.lat, w.lng) }))
    .sort((a, b) => a.d - b.d);
  const nearbyCount = here.filter((x) => x.d <= NEARBY_WALKERS_M).length;

  const emoteButton = (e: Emote, key: string) => (
    <button
      type="button"
      onClick={() => presence.emote(e)}
      aria-label={`${EMOTE_LABEL[e].text} (key ${key})`}
      title={`${EMOTE_LABEL[e].text} · key ${key}`}
      className={`size-12 md:size-11 grid place-items-center rounded-xl text-[20px] transition-colors ${
        e === "help" ? "hover:bg-red-500/15" : "hover:bg-surface-2"
      }`}
    >
      {EMOTE_LABEL[e].icon}
    </button>
  );

  return (
    <>
      {scene && <WeatherOverlay scene={scene} getBearing={getBearing} smog={smog} />}

      {/* Status, weather and proximity (top-centre) */}
      <div className="absolute top-3 md:top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 w-[min(27rem,calc(100%-7rem))] pointer-events-none">
        <div className="nl-glass rounded-full h-10 pl-4 pr-1.5 flex items-center gap-3 text-[12.5px] pointer-events-auto animate-rise">
          <span className={`size-2 rounded-full ${moving ? "bg-accent" : "bg-ink-subtle"}`} />
          <span className="font-medium text-ink truncate max-w-[12rem]" title={start.label}>
            {loading3D ? "Loading character…" : start.label}
          </span>
          <span className="font-mono text-[11.5px] text-ink-subtle">
            {walkedM >= 1000 ? `${(walkedM / 1000).toFixed(2)} km` : `${walkedM} m`}
          </span>
          <button
            onClick={() => setPeopleOpen((o) => !o)}
            aria-expanded={peopleOpen}
            aria-label={`${nearbyCount} other ${nearbyCount === 1 ? "walker" : "walkers"} nearby, ${presence.others.length} online`}
            title={presence.connected ? "People walking with you" : "Reconnecting…"}
            className="h-7 px-2 rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink flex items-center gap-1.5"
          >
            <span className={`size-1.5 rounded-full ${presence.connected ? "bg-ok" : "bg-warn"}`} />
            <Users className="size-3.5" />
            <span className="font-mono text-[11.5px]">{nearbyCount}</span>
          </button>
          <button
            onClick={onExit}
            aria-label="Exit walk mode"
            className="h-7 px-2.5 rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink flex items-center gap-1"
          >
            <X className="size-3.5" /> Exit
          </button>
        </div>

        {helpCall && (
          <div
            role="alert"
            className="w-full rounded-xl bg-red-600 text-white px-3 py-2.5 flex items-center gap-3 pointer-events-auto animate-rise shadow-lg"
          >
            <span className="text-[20px]" aria-hidden>🆘</span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[13.5px] font-semibold truncate">{helpCall.walker.name} needs help</div>
              <div className="text-[12px] text-white/85">
                {Math.round(helpCall.distance)} m {helpCall.direction}. Call 112 if it&apos;s an emergency.
              </div>
            </div>
            <button
              onClick={() => {
                headingRef.current = helpCall.bearing;
                map.easeTo({ bearing: helpCall.bearing, duration: 500 });
              }}
              className="h-8 px-3 rounded-lg bg-white text-red-700 text-[12px] font-semibold shrink-0"
            >
              Turn toward them
            </button>
          </div>
        )}

        {peopleOpen && (
          <div className="nl-glass rounded-xl w-full p-2 pointer-events-auto animate-rise">
            <div className="px-1.5 pb-1.5 flex items-center justify-between text-[11.5px] text-ink-subtle">
              <span>
                {presence.others.length === 0
                  ? "No one else is walking right now"
                  : `${presence.others.length} online · ${nearbyCount} within ${NEARBY_WALKERS_M / 1000} km`}
              </span>
              <span>Share this page to invite people</span>
            </div>
            <ul className="max-h-44 overflow-y-auto flex flex-col gap-0.5">
              {here.slice(0, 20).map(({ w, d }) => (
                <li key={w.id} className="flex items-center gap-2.5 px-1.5 py-1 rounded-lg text-[12.5px]">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: w.color }} />
                  <span className="font-medium text-ink truncate">{w.name}</span>
                  {presence.emoteActive(w) && w.emote && <span aria-label={EMOTE_LABEL[w.emote].text}>{EMOTE_LABEL[w.emote].icon}</span>}
                  <span className="ml-auto shrink-0 text-ink-subtle">
                    {d < 1000 ? `${Math.round(d)} m` : d < 100_000 ? `${(d / 1000).toFixed(1)} km` : w.place || "far away"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className="nl-glass rounded-xl w-full px-3 py-2 flex items-center gap-3 pointer-events-auto animate-rise"
          aria-live="polite"
          aria-busy={updatingWeather}
        >
          {weatherStatus === "loading" && !weather ? (
            <span className="text-[12.5px] text-ink-muted py-1">Getting live weather…</span>
          ) : weatherStatus === "error" && !weather ? (
            <>
              <span className="flex-1 text-[12.5px] text-ink-muted py-1">Live weather unavailable</span>
              <button
                onClick={() => void fetchWeather(posRef.current)}
                className="h-8 px-2.5 rounded-lg text-[12px] font-medium text-ink-muted hover:bg-surface-2 flex items-center gap-1.5"
              >
                <RefreshCw className="size-3.5" /> Retry
              </button>
            </>
          ) : (
            weather &&
            shown && (
              <div className="w-full flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  {React.createElement(weatherIconFor(shown), {
                    className: `size-5 shrink-0 ${scene && scene.precip !== "none" ? "text-sky-500" : "text-ink-muted"}`,
                  })}
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-[13px] font-medium text-ink truncate">
                      {weatherLabel(shown.weatherCode)} · {Math.round(shown.temperatureC)}°C
                      <span className="text-ink-subtle font-normal"> feels {Math.round(shown.feelsLikeC)}°</span>
                    </div>
                    <div className="text-[11.5px] text-ink-subtle truncate">
                      {shown.precipitationMm > 0 && `${shown.precipitationMm} mm last 15 min · `}
                      Wind {Math.round(shown.windKmh)} km/h from {compassPoint(shown.windFromDeg)} · {shown.humidityPct}% RH
                    </div>
                  </div>
                  {updatingWeather && (
                    <RefreshCw className="size-3.5 shrink-0 text-ink-subtle animate-spin" aria-label="Updating weather" />
                  )}
                </div>
                {(aq || (flood && flood.riskLevel !== "INSUFFICIENT_DATA")) && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                    {aq && (
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold ${aqiPresentation(aq.scale, aq.category).tone}`}
                        title={`${AQI_SCALE_LABEL[aq.scale]} ${aq.aqi}: ${aq.category}. From CAMS model data.`}
                      >
                        AQI {aq.aqi} · {aq.category}
                      </span>
                    )}
                    {masked && <span className="text-ink-subtle">mask on</span>}
                    {flood && flood.riskLevel !== "INSUFFICIENT_DATA" && (
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold ${
                          flood.riskLevel === "HIGH"
                            ? "bg-red-600 text-white"
                            : flood.riskLevel === "ELEVATED"
                              ? "bg-amber-400 text-black"
                              : "bg-surface-2 text-ink-muted"
                        }`}
                        title={flood.explanation}
                      >
                        Flood risk {flood.riskLevel.toLowerCase()}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 text-[11px]">
                  {preview === "live" ? (
                    <span className="flex items-center gap-1.5 text-ink-subtle min-w-0 truncate">
                      <span className="nl-live-dot text-accent shrink-0" />
                      Live here · Open-Meteo {weather.observedAt.slice(11, 16)} ·{" "}
                      <span className="font-mono">
                        {weather.latitude.toFixed(2)}, {weather.longitude.toFixed(2)}
                      </span>
                    </span>
                  ) : (
                    <span className="min-w-0 truncate">
                      <span className="px-1.5 py-0.5 rounded bg-warn/15 text-warn font-semibold uppercase tracking-wide">
                        Preview
                      </span>{" "}
                      <span className="text-ink-subtle">
                        not live · actually {weatherLabel(weather.weatherCode).toLowerCase()}, {Math.round(weather.temperatureC)}°C
                      </span>
                    </span>
                  )}
                  <label className="ml-auto shrink-0 flex items-center gap-1 text-ink-subtle">
                    <span className="sr-only">Weather shown</span>
                    <select
                      value={preview}
                      onChange={(e) => setPreview(e.target.value as typeof preview)}
                      className="h-7 rounded-md border border-line bg-surface px-1.5 text-[11.5px] text-ink focus:outline-none focus:border-accent"
                    >
                      <option value="live">Live weather</option>
                      <optgroup label="Preview (not live)">
                        {Object.entries(WEATHER_PREVIEWS).map(([key, p]) => (
                          <option key={key} value={key}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </label>
                </div>
              </div>
            )
          )}
        </div>

        {nearby && (
          <div
            role="status"
            className="nl-glass rounded-xl w-full px-3 py-2 flex items-center gap-3 pointer-events-auto animate-rise"
          >
            <AlertTriangle
              className={`size-4 shrink-0 ${nearby.poi.kind === "help" ? "text-ok" : "text-warn"}`}
            />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[13px] font-medium text-ink truncate">{nearby.poi.label}</div>
              <div className="text-[11.5px] text-ink-subtle">
                {KIND_LABEL[nearby.poi.kind]} · {Math.round(nearby.distance)} m {nearby.direction}
              </div>
            </div>
            <button
              onClick={() => onOpenDetails(nearby.poi.id)}
              className="h-8 px-3 rounded-lg bg-ink text-canvas text-[12px] font-medium shrink-0"
            >
              Details
            </button>
          </div>
        )}
      </div>

      {/* D-pad (bottom-centre) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 animate-rise">
        <div className="flex items-end gap-2">
        <div role="group" aria-label="Emotes" className="nl-glass rounded-2xl p-1.5 flex flex-col gap-1 select-none">
          {emoteButton("wave", "1")}
          {emoteButton("thanks", "2")}
          {emoteButton("help", "3")}
        </div>
        <div
          role="group"
          aria-label="Walk controls"
          className="nl-glass rounded-2xl p-1.5 grid grid-cols-3 grid-rows-2 gap-1 select-none"
        >
          {padButton("forward", "Walk forward", ArrowBigUp, "col-start-2 row-start-1")}
          {padButton("left", "Turn left", ArrowBigLeft, "col-start-1 row-start-2")}
          {padButton("back", "Walk backward", ArrowBigDown, "col-start-2 row-start-2")}
          {padButton("right", "Turn right", ArrowBigRight, "col-start-3 row-start-2")}
        </div>
        </div>
        <p className="hidden md:block nl-glass rounded-full px-3 py-1 text-[11.5px] text-ink-muted">
          Arrow keys or WASD · Shift to run · 1 👋 2 🙏 3 🆘 · Esc to exit
        </p>
      </div>
    </>
  );
}
