"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as maplibregl from "maplibre-gl";
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
  X,
  type LucideIcon,
} from "lucide-react";
import { createWalker3D, WALKER_LAYER_ID, type Walker3D } from "./walker-3d";
import { WeatherOverlay } from "./weather-overlay";
import type { WalkStart } from "./walk-start-dialog";
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
  const walkerRef = useRef<Walker3D | null>(null);
  const [moving, setMoving] = useState(false);
  const [walkedM, setWalkedM] = useState(0);
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [pressed, setPressed] = useState<Set<Dir>>(new Set());
  const [loading3D, setLoading3D] = useState(true);
  const getBearing = useCallback(() => map.getBearing(), [map]);

  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"loading" | "ok" | "error">("loading");
  const [updatingWeather, setUpdatingWeather] = useState(false);
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
      const res = await fetch(`/api/weather?lat=${at.lat.toFixed(4)}&lng=${at.lng.toFixed(4)}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setWeather(json.data);
      setWeatherStatus("ok");
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

  // Character outfit / lighting and the map's sky follow the weather.
  useEffect(() => {
    sceneRef.current = scene;
    if (!scene) return;
    const daylight = scene.isDay
      ? Math.max(0.3, 1 - scene.cloudCover * 0.4 - (scene.precip === "none" ? 0 : 0.2) - scene.fog * 0.2)
      : 0.12;
    walkerRef.current?.setWeather({ precip: scene.precip, daylight });
    map.setSky(skyFor(scene));
  }, [scene, map]);

  // 3D character, camera and movement loop live for the whole walk.
  useEffect(() => {
    let cancelled = false;
    const originalSky = map.getSky();
    const addLayer = () => {
      const w = walkerRef.current;
      if (w && !map.getLayer(WALKER_LAYER_ID)) map.addLayer(w.layer);
      if (sceneRef.current) map.setSky(skyFor(sceneRef.current));
    };

    void createWalker3D(map, { ...start, heading: headingRef.current, gait: 0 }).then((w) => {
      if (cancelled) {
        w.dispose();
        return;
      }
      walkerRef.current = w;
      const sc = sceneRef.current;
      if (sc) w.setWeather({ precip: sc.precip, daylight: sc.isDay ? 1 - sc.cloudCover * 0.4 : 0.12 });
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
      walkerRef.current?.setPose({ ...posRef.current, heading: headingRef.current, gait });

      if (isMoving !== wasMoving) {
        wasMoving = isMoving;
        setMoving(isMoving);
      }

      // Distance, proximity and weather checks don't need 60 fps.
      if (now - lastReport > 250) {
        lastReport = now;
        setWalkedM(Math.round(walked));
        const { lat, lng } = posRef.current;

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
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      map.off("style.load", addLayer);
      if (map.getLayer(WALKER_LAYER_ID)) map.removeLayer(WALKER_LAYER_ID);
      walkerRef.current?.dispose();
      walkerRef.current = null;
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

  return (
    <>
      {scene && <WeatherOverlay scene={scene} getBearing={getBearing} />}

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
            onClick={onExit}
            aria-label="Exit walk mode"
            className="h-7 px-2.5 rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink flex items-center gap-1"
          >
            <X className="size-3.5" /> Exit
          </button>
        </div>

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
        <p className="hidden md:block nl-glass rounded-full px-3 py-1 text-[11.5px] text-ink-muted">
          Arrow keys or WASD · hold Shift to run · Esc to exit
        </p>
      </div>
    </>
  );
}
