"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import { useTheme } from "next-themes";
import {
  Compass,
  Navigation,
  RotateCcw,
  RotateCw,
  AlertTriangle,
  Plus,
  Minus,
  Maximize2,
  Footprints,
} from "lucide-react";
import { getMapStyle, getMapTilerKey, LIGHT_MAP_STYLE, DARK_MAP_STYLE } from "@/lib/map-styles";
import { useMapApiKeyOverride } from "@/lib/map-key";
import { applyMapEnhancements, type MapCapabilities } from "./map-enhancements";
import {
  INITIAL_INCIDENTS,
  INITIAL_OFFICIAL_HAZARDS,
  INITIAL_RISK_ESTIMATES,
  INITIAL_HELP_CENTRES,
} from "@/lib/demo-data";
import { useDemo } from "@/context/demo-context";
import { humanize } from "@/components/ui/primitives";
import { HAZARD_TONE, INCIDENT_TONE, RISK_TONE, SOS_CATEGORY_LABEL, formatDateTime } from "@/lib/status";
import {
  detailsButtonHTML,
  esc,
  labelHTML,
  liveHazardHTML,
  manualLocationHTML,
  pickPinHTML,
  pinHTML,
  popupHTML,
  sosAreaHTML,
  sosPinHTML,
  sourceLinkHTML,
  userLocationHTML,
  wireDetailsButton,
} from "./marker-html";
import { useOverlay, isDrawer } from "@/context/overlay-context";
import { LayersPopover, MAP_LAYERS, MapTypePopover } from "./map-popovers";
import { useEscape } from "@/components/ui/a11y";
import { formatAccuracy } from "@/lib/use-live-location";
import { WalkMode, type WalkPoi } from "./walk-mode";
import { WalkStartDialog, type WalkStart } from "./walk-start-dialog";
import { MapPresence } from "./map-presence";

const INCIDENT_PIN_BG: Record<string, string> = {
  UNVERIFIED: "bg-amber-500",
  CORROBORATED: "bg-sky-600",
  RESOLVED: "bg-emerald-600",
  DISPUTED: "bg-rose-500",
};

/** Scale the accuracy ring to its real-world radius at the current zoom. */
function sizeAccuracyRing(el: HTMLElement, zoom: number) {
  const ring = el.querySelector<HTMLElement>("[data-accuracy]");
  const accuracy = Number(el.dataset.accuracy);
  const lat = Number(el.dataset.lat);
  if (!ring || !accuracy) return;
  // MapLibre uses 512px tiles: metres per pixel at the equator, scaled by latitude.
  const metresPerPx = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
  const diameter = Math.min(Math.max((accuracy / metresPerPx) * 2, 0), 4000);
  ring.style.width = ring.style.height = `${diameter}px`;
  ring.style.display = diameter < 24 ? "none" : "";
}

/** Comfortable 3D perspective. */
const PITCH_3D = 58;


/** The map workspace. Stays mounted for the whole session (one instance). */
export function GeospatialMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { resolvedTheme } = useTheme();

  const {
    currentLocality,
    layerFilters,
    toggleLayer,
    currentRole,
    currentUser,
    selectedIncidentId,
    setSelectedIncidentId,
    is3D,
    setIs3D,
    incidents,
    sosRequests,
    liveHazards,
    liveLocation,
    locationStatus,
    locationError,
    startLiveLocation,
    stopLiveLocation,
    basemapType,
    satelliteLabels,
    manualLocation,
    setManualLocation,
    mapFocus,
  } = useDemo();
  const isDark = resolvedTheme === "dark";
  const mapApiKey = useMapApiKeyOverride();

  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const manualMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Follow mode: "paused" when the user pans away; they can resume explicitly.
  const [follow, setFollow] = useState<"off" | "on" | "paused">("off");
  const centerOnNextFixRef = useRef(false);
  const { overlay, open: openOverlay, picking, pickLocation, finishPick } = useOverlay();
  const pickingLocation = !!picking;
  const pickingRef = useRef(false);
  const pickMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [pickPos, setPickPos] = useState<{ lat: number; lng: number } | null>(null);
  const confirmPickRef = useRef<HTMLButtonElement>(null);
  const openDetailsRef = useRef<(id: string) => void>(() => {});

  const [mapLoaded, setMapLoaded] = useState(false);
  /** The map instance for children that render into it (set once loaded). */
  const [mapObj, setMapObj] = useState<maplibregl.Map | null>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const canvas = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch {
      return false;
    }
  });
  const [bearing, setBearing] = useState(0);
  const [popover, setPopover] = useState<"type" | "layers" | null>(null);
  const [capabilities, setCapabilities] = useState<MapCapabilities>({ buildings: false, terrain: false });
  const keyRejectedRef = useRef(false);
  const cameraSnapshotRef = useRef<maplibregl.JumpToOptions | null>(null);
  const appliedStyleRef = useRef<string | null>(null);
  const pendingFlyRef = useRef<maplibregl.FlyToOptions | null>(null);
  const [visibleIncidentCount, setVisibleIncidentCount] = useState<number | null>(null);
  // A walk belongs to the area it started in; picking another area ends it.
  const [walkState, setWalk] = useState<{ map: maplibregl.Map; start: WalkStart; localityId: string } | null>(null);
  const walk = walkState && walkState.localityId === currentLocality.id ? walkState : null;
  const [choosingWalkStart, setChoosingWalkStart] = useState(false);

  // Compute visible incidents within current map viewport
  const updateVisibleCount = useCallback(() => {
    if (!map.current) return;
    try {
      const bounds = map.current.getBounds();
      let count = 0;
      if (layerFilters.communityReports) {
        incidents.forEach((i) => {
          if (bounds.contains([i.longitude, i.latitude])) count++;
        });
      }
      if (layerFilters.sosAreas) {
        sosRequests.forEach((s) => {
          const lng = s.longitude || s.exactLongitude || s.fuzzyLongitude;
          const lat = s.latitude || s.exactLatitude || s.fuzzyLatitude;
          if (lng && lat && bounds.contains([lng, lat])) count++;
        });
      }
      if (layerFilters.officialHazards) {
        INITIAL_OFFICIAL_HAZARDS.forEach((h) => {
          if (bounds.contains([h.centerLng, h.centerLat])) count++;
        });
      }
      if (layerFilters.riskEstimates) {
        INITIAL_RISK_ESTIMATES.forEach((r) => {
          if (bounds.contains([r.centerLng, r.centerLat])) count++;
        });
      }
      if (layerFilters.helpCentres) {
        INITIAL_HELP_CENTRES.forEach((c) => {
          if (bounds.contains([c.longitude, c.latitude])) count++;
        });
      }
      if (layerFilters.liveFeeds && liveHazards) {
        liveHazards.hazards.forEach((h) => {
          if (bounds.contains([h.longitude, h.latitude])) count++;
        });
      }
      setVisibleIncidentCount(count);
    } catch {
      // ignore
    }
  }, [layerFilters, incidents, sosRequests, liveHazards]);

  // Fit map viewport to encompass all active incidents, hazards, and SOS alerts
  const fitToActiveIncidents = useCallback(() => {
    if (!map.current) return;

    const coords: [number, number][] = [];

    if (layerFilters.communityReports) {
      incidents.forEach((i) => coords.push([i.longitude, i.latitude]));
    }
    if (layerFilters.sosAreas) {
      sosRequests.forEach((s) => {
        const lng = s.longitude || s.exactLongitude || s.fuzzyLongitude;
        const lat = s.latitude || s.exactLatitude || s.fuzzyLatitude;
        if (lng && lat) coords.push([lng, lat]);
      });
    }
    if (layerFilters.officialHazards) {
      INITIAL_OFFICIAL_HAZARDS.forEach((h) => coords.push([h.centerLng, h.centerLat]));
    }
    if (layerFilters.riskEstimates) {
      INITIAL_RISK_ESTIMATES.forEach((r) => coords.push([r.centerLng, r.centerLat]));
    }
    if (layerFilters.helpCentres) {
      INITIAL_HELP_CENTRES.forEach((c) => coords.push([c.longitude, c.latitude]));
    }
    if (layerFilters.liveFeeds && liveHazards?.hazards?.length) {
      liveHazards.hazards.forEach((h) => coords.push([h.longitude, h.latitude]));
    }

    if (coords.length === 0) {
      INITIAL_INCIDENTS.forEach((i) => coords.push([i.longitude, i.latitude]));
    }

    const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
    coords.forEach((c) => bounds.extend(c));

    map.current.fitBounds(bounds, {
      padding: { top: 90, bottom: 90, left: 90, right: 90 },
      maxZoom: 15,
      duration: 1400,
    });
  }, [layerFilters, incidents, sosRequests, liveHazards]);

  // (Re)apply buildings / terrain / label visibility for the current options.
  // Called from the persistent `style.load` handler and when options change.
  const enhanceRef = useRef<() => void>(() => {});
  // True between `style.load` and the next `setStyle()`. (isStyleLoaded() also
  // waits for tiles, so it is still false while style.load is firing.)
  const styleReadyRef = useRef(false);
  const enhance = () => {
    const m = map.current;
    if (!m || !styleReadyRef.current) return;
    try {
      setCapabilities(
        applyMapEnhancements(m, {
          is3D,
          isDark,
          basemap: basemapType,
          showLabels: satelliteLabels,
          mapTilerKey: keyRejectedRef.current ? null : getMapTilerKey(mapApiKey),
        })
      );
    } catch (err) {
      console.warn("Map enhancement skipped:", err);
    }
  };

  // Fly once the map is visible (it is hidden, 0×0, while other tabs show).
  const flyWhenVisible = useCallback((opts: maplibregl.FlyToOptions) => {
    const m = map.current;
    if (m && m.getContainer().clientWidth > 0) {
      pendingFlyRef.current = null;
      m.flyTo({ essential: true, ...opts });
    } else {
      pendingFlyRef.current = opts;
    }
  }, []);

  const isDarkRef = useRef(isDark);
  const updateVisibleCountRef = useRef(updateVisibleCount);

  // Keep refs used by long-lived map event handlers current. Declared before
  // the effects that call them so it runs first each commit.
  useEffect(() => {
    pickingRef.current = pickingLocation;
    openDetailsRef.current = (id: string) => {
      setSelectedIncidentId(id);
      void openOverlay({ kind: "details", id });
    };
    isDarkRef.current = isDark;
    updateVisibleCountRef.current = updateVisibleCount;
    enhanceRef.current = enhance;
  });

  // Initialize Map (once; the component stays mounted across tabs)
  useEffect(() => {
    if (!mapContainer.current || map.current || !webGlSupported) return;

    // Explicitly configure worker URL to prevent Next.js Turbopack blob loader error
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      maplibregl.setWorkerUrl(`${origin}/maplibre-gl-worker.js`);
    } catch (e) {
      console.warn("MapLibre workerUrl setup note:", e);
    }

    const initialStyle = getMapStyle(isDark, mapApiKey, basemapType);
    appliedStyleRef.current = `${basemapType}|${isDark}|${mapApiKey}`;

    let resizeObserver: ResizeObserver | null = null;
    try {
      const m = new maplibregl.Map({
        container: mapContainer.current,
        style: initialStyle,
        center: [currentLocality.lng, currentLocality.lat],
        zoom: currentLocality.zoom,
        pitch: is3D ? PITCH_3D : 0,
        maxPitch: 70,
        // Basemap tiles stop at z16–18; past ~20 enlarged tiles are just blur.
        maxZoom: 20,
        attributionControl: false,
      });

      // If the key is rejected, fall back to open tiles and stop requesting
      // MapTiler terrain with it.
      m.on("error", (e) => {
        const errorMsg = e?.error?.message || "";
        if (/40[13]|Forbidden|Unauthorized/.test(errorMsg) && !keyRejectedRef.current) {
          console.warn("Map provider rejected the key; using open fallback tiles:", errorMsg);
          keyRejectedRef.current = true;
          styleReadyRef.current = false;
          m.setStyle(isDarkRef.current ? DARK_MAP_STYLE : LIGHT_MAP_STYLE);
        }
      });

      // Tile sources carry their own attribution; start collapsed so it
      // doesn't cover the map on small screens.
      m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      m.once("load", () =>
        m.getContainer()
          .querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show")
      );

      // Single persistent handler for every style (initial, theme, basemap,
      // fallback): restore the camera snapshot, then re-add custom layers.
      m.on("style.load", () => {
        styleReadyRef.current = true;
        if (cameraSnapshotRef.current) {
          m.jumpTo(cameraSnapshotRef.current);
          cameraSnapshotRef.current = null;
        }
        enhanceRef.current();
      });

      m.on("load", () => {
        setMapLoaded(true);
        setMapObj(m);
        setBearing(Math.round(m.getBearing()));
        setIs3D(m.getPitch() >= 20);
        updateVisibleCount();
      });

      m.on("rotate", () => setBearing(Math.round(m.getBearing())));
      // Perspective state follows the real camera (incl. two-finger tilt).
      m.on("pitchend", () => setIs3D(m.getPitch() >= 20));
      m.on("moveend", () => updateVisibleCountRef.current());

      m.on("click", (e) => {
        // While choosing a location, a tap moves the pin.
        if (pickingRef.current) {
          pickMarkerRef.current?.setLngLat(e.lngLat);
          setPickPos({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        }
      });

      // Container size changes (tab switches, drawer, rotation, mobile
      // browser chrome) need an explicit resize.
      resizeObserver = new ResizeObserver(() => {
        m.resize();
        if (pendingFlyRef.current && m.getContainer().clientWidth > 0) {
          const pending = pendingFlyRef.current;
          pendingFlyRef.current = null;
          m.flyTo({ essential: true, ...pending });
        }
      });
      resizeObserver.observe(mapContainer.current);

      map.current = m;
      // Dev-only handle for debugging/QA in the browser console.
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __nlMap?: maplibregl.Map }).__nlMap = m;
      }
    } catch (err) {
      console.error("MapLibre initialization failed:", err);
      setWebGlSupported(false);
    }

    return () => {
      resizeObserver?.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once
  }, [webGlSupported]);

  // Theme / basemap / key change → swap the style, preserving the camera.
  // Markers are DOM elements and survive; custom layers are re-added by the
  // style.load handler. Rapid switching is safe: the last setStyle wins and
  // the handler always reads current options.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;
    const id = `${basemapType}|${isDark}|${mapApiKey}`;
    if (appliedStyleRef.current === id) return;
    appliedStyleRef.current = id;
    if (mapApiKey) keyRejectedRef.current = false;

    styleReadyRef.current = false;
    cameraSnapshotRef.current = {
      center: m.getCenter(),
      zoom: m.getZoom(),
      pitch: m.getPitch(),
      bearing: m.getBearing(),
    };
    m.setStyle(
      keyRejectedRef.current
        ? isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE
        : getMapStyle(isDark, mapApiKey, basemapType)
    );
  }, [isDark, mapApiKey, basemapType, mapLoaded]);

  // Perspective / labels change without a style reload.
  useEffect(() => {
    enhanceRef.current();
  }, [is3D, satelliteLabels, mapLoaded]);

  // Locality change → fly there.
  useEffect(() => {
    if (!mapLoaded) return;
    flyWhenVisible({
      center: [currentLocality.lng, currentLocality.lat],
      zoom: currentLocality.zoom,
      duration: 1800,
    });
  }, [currentLocality, mapLoaded, flyWhenVisible]);

  // "Show on map" from the feed / search.
  useEffect(() => {
    if (!mapFocus || !mapLoaded) return;
    flyWhenVisible({
      center: [mapFocus.lng, mapFocus.lat],
      zoom: Math.max(mapFocus.zoom ?? 15, 13),
      duration: 1200,
    });
  }, [mapFocus, mapLoaded, flyWhenVisible]);

  // 2D ↔ 3D. The button reflects the real camera pitch (see `pitchend`).
  const toggle3D = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const willBe3D = m.getPitch() < 20;
    setIs3D(willBe3D);
    m.easeTo(
      willBe3D
        ? { pitch: PITCH_3D, bearing: m.getBearing() || -17, duration: 900 }
        : { pitch: 0, bearing: 0, duration: 700 }
    );
  }, [setIs3D]);

  const rotateBy = (deg: number) =>
    map.current?.easeTo({ bearing: map.current.getBearing() + deg, duration: 450 });

  const resetNorth = () => {
    map.current?.easeTo({ bearing: 0, duration: 500 });
  };

  // My location: first press starts sharing and centres once; later presses
  // recentre. Following is a separate, explicit toggle.
  const locateMe = () => {
    if (locationStatus === "active" && liveLocation) {
      map.current?.easeTo({
        center: [liveLocation.lng, liveLocation.lat],
        zoom: Math.max(map.current.getZoom(), 15),
        duration: 800,
      });
      return;
    }
    centerOnNextFixRef.current = true;
    startLiveLocation();
  };

  const setFollowMode = (mode: "on" | "off") => {
    setFollow(mode);
    if (mode === "on" && liveLocation) {
      map.current?.easeTo({
        center: [liveLocation.lng, liveLocation.lat],
        zoom: Math.max(map.current.getZoom(), 15),
        duration: 700,
      });
    }
  };

  const stopSharing = () => {
    stopLiveLocation();
    setFollow("off");
  };

  // Keep the "you are here" marker in sync with the device position.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    if (!liveLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    const { lat, lng, accuracy, heading } = liveLocation;
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "marker-user";
      el.innerHTML = userLocationHTML();
      userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(m);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
    }

    const el = userMarkerRef.current.getElement();
    el.dataset.accuracy = String(accuracy);
    el.dataset.lat = String(lat);
    sizeAccuracyRing(el, m.getZoom());

    const cone = el.querySelector<HTMLElement>("[data-heading]");
    if (cone) {
      cone.classList.toggle("hidden", heading === null);
      if (heading !== null) cone.style.transform = `rotate(${heading}deg)`;
    }

    if (centerOnNextFixRef.current) {
      centerOnNextFixRef.current = false;
      m.easeTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 15), duration: 1100 });
    } else if (follow === "on") {
      m.easeTo({ center: [lng, lat], duration: 600 });
    }
  }, [liveLocation, mapLoaded, follow]);

  // Manual fallback location marker.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;
    if (!manualLocation || liveLocation) {
      manualMarkerRef.current?.remove();
      manualMarkerRef.current = null;
      return;
    }
    if (!manualMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = manualLocationHTML();
      manualMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([manualLocation.lng, manualLocation.lat])
        .addTo(m);
    } else {
      manualMarkerRef.current.setLngLat([manualLocation.lng, manualLocation.lat]);
    }
  }, [manualLocation, liveLocation, mapLoaded]);

  // Accuracy ring is in metres, so resize it with zoom. A user drag (not a
  // programmatic move) pauses following.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;
    const onZoom = () => {
      const el = userMarkerRef.current?.getElement();
      if (el) sizeAccuracyRing(el, m.getZoom());
    };
    const onDragStart = () => setFollow((f) => (f === "on" ? "paused" : f));
    m.on("zoom", onZoom);
    m.on("dragstart", onDragStart);
    return () => {
      m.off("zoom", onZoom);
      m.off("dragstart", onDragStart);
    };
  }, [mapLoaded]);

  // Choose-on-map: draggable pin; the requesting form stays mounted (draft kept).
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded || !picking) return;
    const start = picking.initial ?? { lat: m.getCenter().lat, lng: m.getCenter().lng };
    const el = document.createElement("div");
    el.innerHTML = pickPinHTML();
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true })
      .setLngLat([start.lng, start.lat])
      .addTo(m);
    marker.on("dragend", () => {
      const p = marker.getLngLat();
      setPickPos({ lat: p.lat, lng: p.lng });
    });
    pickMarkerRef.current = marker;
    setPickPos(start);
    m.easeTo({ center: [start.lng, start.lat], zoom: Math.max(m.getZoom(), 15), duration: 600 });
    return () => {
      marker.remove();
      pickMarkerRef.current = null;
      setPickPos(null);
    };
  }, [picking, mapLoaded]);

  useEscape(pickingLocation, () => finishPick(null));

  // The form is hidden while picking: move keyboard focus to the location bar.
  useEffect(() => {
    if (!picking) return;
    const t = setTimeout(() => confirmPickRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [picking]);

  const pickMyLocation = async () => {
    const c = map.current?.getCenter();
    const p = await pickLocation("my-location", manualLocation ?? (c ? { lat: c.lat, lng: c.lng } : null));
    if (p) setManualLocation(p);
  };

  // Render Geospatial HTML Markers
  const renderMarkers = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const isResponder = currentRole === "RESPONDER" || currentRole === "ADMIN";

    // 1. Community Incidents
    if (layerFilters.communityReports) {
      incidents.forEach((inc) => {
        const el = document.createElement("div");
        el.className = "marker-incident cursor-pointer";
        el.innerHTML = pinHTML({
          icon: "alert",
          bg: INCIDENT_PIN_BG[inc.status] ?? "bg-amber-500",
          count: inc.observationCount,
        });

        const popup = new maplibregl.Popup({ offset: 22, closeButton: true }).setHTML(
          popupHTML({
            badge: humanize(inc.status),
            tone: INCIDENT_TONE[inc.status] ?? "warn",
            code: inc.trackingCode,
            title: inc.categoryLabel,
            body: esc(inc.description),
            meta: `Community observation · ${esc(inc.localityName)}<br/>Observed ${esc(formatDateTime(inc.observedAt))} · ${inc.observationCount} independent observation${inc.observationCount === 1 ? "" : "s"}`,
            footer: detailsButtonHTML(inc.id),
          })
        );

        wireDetailsButton(popup, inc.id, (id) => openDetailsRef.current(id));
        el.dataset.id = inc.id;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([inc.longitude, inc.latitude])
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // 2. SOS Rescue Areas (privacy: civilians only ever see the fuzzed area)
    if (layerFilters.sosAreas) {
      sosRequests.forEach((sos: any) => {
        const lat = isResponder ? (sos.latitude || sos.exactLatitude) : (sos.fuzzyLatitude || sos.latitude);
        const lng = isResponder ? (sos.longitude || sos.exactLongitude) : (sos.fuzzyLongitude || sos.longitude);

        const el = document.createElement("div");
        el.className = "marker-sos cursor-pointer";
        el.innerHTML = isResponder ? sosPinHTML() : sosAreaHTML();

        const people = `${sos.peopleCount} ${sos.peopleCount > 1 ? "people" : "person"}`;
        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
          popupHTML({
            badge: isResponder ? "SOS · exact location" : "SOS · approximate area",
            tone: "danger",
            code: sos.trackingCode,
            title: `${SOS_CATEGORY_LABEL[sos.category as keyof typeof SOS_CATEGORY_LABEL] ?? "Emergency request"} · ${people}`,
            body: isResponder
              ? esc(sos.description)
              : "Rescue requested nearby. The location is blurred to roughly 1 km to protect the requester.",
            meta: isResponder
              ? `<span class="text-ink font-mono">${esc(sos.contactPhone)}</span> · ${esc(sos.requesterName)}`
              : undefined,
            footer: detailsButtonHTML(sos.id),
          })
        );
        wireDetailsButton(popup, sos.id, (id) => openDetailsRef.current(id));
        el.dataset.id = sos.id;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // 3. Official Hazards
    if (layerFilters.officialHazards) {
      INITIAL_OFFICIAL_HAZARDS.forEach((haz) => {
        const el = document.createElement("div");
        el.className = "marker-official cursor-pointer";
        el.innerHTML = pinHTML({ icon: "shield", bg: "bg-orange-500", square: true });

        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
          popupHTML({
            badge: `Official · ${humanize(haz.severity)}`,
            tone: HAZARD_TONE[haz.severity],
            title: haz.headline,
            body: esc(haz.description),
            meta: `${esc(haz.source)}<br/>Issued ${esc(formatDateTime(haz.issuedAt))} · expires ${esc(formatDateTime(haz.expiresAt))}`,
            footer: detailsButtonHTML(haz.id),
          })
        );
        wireDetailsButton(popup, haz.id, (id) => openDetailsRef.current(id));
        el.dataset.id = haz.id;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([haz.centerLng, haz.centerLat])
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // 4. Experimental Flood Risk Estimates
    if (layerFilters.riskEstimates) {
      INITIAL_RISK_ESTIMATES.forEach((risk) => {
        const el = document.createElement("div");
        el.className = "marker-risk cursor-pointer";
        el.innerHTML = labelHTML(`${humanize(risk.riskLevel)} flood risk`, "bg-indigo-500");

        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
          popupHTML({
            badge: `Experimental · ${humanize(risk.riskLevel)} risk`,
            tone: RISK_TONE[risk.riskLevel],
            title: risk.localityName,
            body: esc(risk.explanation),
            meta: `Evaluated ${esc(formatDateTime(risk.evaluatedAt))} · not an official warning`,
            footer: detailsButtonHTML(risk.id),
          })
        );
        wireDetailsButton(popup, risk.id, (id) => openDetailsRef.current(id));
        el.dataset.id = risk.id;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([risk.centerLng, risk.centerLat])
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // 5. Help Centres
    if (layerFilters.helpCentres) {
      INITIAL_HELP_CENTRES.forEach((hc) => {
        const el = document.createElement("div");
        el.className = "marker-help cursor-pointer";
        el.innerHTML = pinHTML({ icon: "home", bg: "bg-emerald-600", square: true });

        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
          popupHTML({
            badge: "Help centre",
            tone: "ok",
            title: hc.name,
            meta: `<span class="font-mono text-ink">${hc.capacityAvailable}/${hc.capacityTotal}</span> spaces free · <span class="font-mono">${esc(hc.contactPhone)}</span>`,
            footer: detailsButtonHTML(hc.id, "All help centres"),
          })
        );
        wireDetailsButton(popup, hc.id, () => void openOverlay({ kind: "help" }));
        el.dataset.id = hc.id;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([hc.longitude, hc.latitude])
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Live India feeds (USGS earthquakes, GDACS cyclones / floods / droughts)
    if (layerFilters.liveFeeds && liveHazards) {
      liveHazards.hazards.forEach((h) => {
        const el = document.createElement("div");
        el.className = "marker-live cursor-pointer";
        el.innerHTML = liveHazardHTML(h);
        const when = new Date(h.startedAt);
        const status = h.isCurrent
          ? "Active"
          : h.endedAt
            ? `Ended ${formatDateTime(h.endedAt)}`
            : "Past event";
        const popup = new maplibregl.Popup({ offset: 22 }).setHTML(
          popupHTML({
            badge: `Live · ${h.source} · ${humanize(h.type)}`,
            tone: h.alertLevel === "RED" ? "danger" : h.alertLevel === "ORANGE" ? "warn" : "accent",
            code: h.alertLevel ? `${h.alertLevel} alert` : undefined,
            title: h.title,
            body: esc(h.detail),
            meta: `${esc(status)} · started ${esc(formatDateTime(when.toISOString()))}<br/>Real-time public feed, not a Neighbourlink report.`,
            footer: sourceLinkHTML(h.url, h.source === "USGS" ? "USGS event page" : "GDACS report"),
          })
        );
        el.dataset.id = h.id;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([h.longitude, h.latitude])
          .setPopup(popup)
          .addTo(map.current!);
        markersRef.current.push(marker);
      });
    }

    // Update count of markers visible in viewport
    updateVisibleCount();
  }, [
    mapLoaded,
    layerFilters,
    currentRole,
    incidents,
    sosRequests,
    liveHazards,
    updateVisibleCount,
    openOverlay,
  ]);

  // Re-run markers whenever layers or role changes
  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  // Handle selected incident, official hazard, risk estimate, or SOS flyTo
  // Highlight the selected item's marker (set by "View on map" / details).
  useEffect(() => {
    markersRef.current.forEach((mk) => {
      const el = mk.getElement();
      el.classList.toggle("is-selected", !!selectedIncidentId && el.dataset.id === selectedIncidentId);
    });
  }, [selectedIncidentId, mapLoaded, layerFilters, incidents, sosRequests]);

  // Desktop: keep markers clear of the right-hand drawer.
  const drawerOpen = isDrawer(overlay);
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    const right = drawerOpen && desktop ? (window.matchMedia("(min-width: 1024px)").matches ? 420 : 380) : 0;
    // Only the right edge belongs to the drawer; walk mode owns the top.
    m.easeTo({ padding: { ...m.getPadding(), right }, duration: 300 });
  }, [drawerOpen, mapLoaded]);

  // Walk mode first asks where to start (GPS or a typed city).
  const startWalk = () => {
    setPopover(null);
    setChoosingWalkStart(true);
  };
  const beginWalk = (start: WalkStart) => {
    const m = map.current;
    setChoosingWalkStart(false);
    if (m) setWalk({ map: m, start, localityId: currentLocality.id });
  };
  const mapCentre = () => {
    const c = map.current?.getCenter();
    return c ? { lat: c.lat, lng: c.lng } : { lat: currentLocality.lat, lng: currentLocality.lng };
  };
  const exitWalk = useCallback(() => setWalk(null), []);
  const openWalkDetails = useCallback((id: string) => openDetailsRef.current(id), []);

  // Things worth warning a walker about, from the layers currently shown.
  const walkPois = useMemo<WalkPoi[]>(() => {
    const isResponder = currentRole === "RESPONDER" || currentRole === "ADMIN";
    const pois: WalkPoi[] = [];
    if (layerFilters.communityReports) {
      incidents
        .filter((i) => i.status !== "RESOLVED")
        .forEach((i) => pois.push({ id: i.id, lat: i.latitude, lng: i.longitude, label: i.categoryLabel, kind: "report" }));
    }
    if (layerFilters.sosAreas) {
      sosRequests
        .filter((s: any) => s.status !== "RESOLVED")
        .forEach((s: any) =>
          pois.push({
            id: s.id,
            lat: isResponder ? s.latitude || s.exactLatitude : s.fuzzyLatitude || s.latitude,
            lng: isResponder ? s.longitude || s.exactLongitude : s.fuzzyLongitude || s.longitude,
            label: SOS_CATEGORY_LABEL[s.category as keyof typeof SOS_CATEGORY_LABEL] ?? "Emergency request",
            kind: "sos",
          })
        );
    }
    if (layerFilters.officialHazards) {
      INITIAL_OFFICIAL_HAZARDS.forEach((h) =>
        pois.push({ id: h.id, lat: h.centerLat, lng: h.centerLng, label: h.headline, kind: "official" })
      );
    }
    if (layerFilters.helpCentres) {
      INITIAL_HELP_CENTRES.forEach((c) =>
        pois.push({ id: c.id, lat: c.latitude, lng: c.longitude, label: c.name, kind: "help" })
      );
    }
    return pois;
  }, [incidents, sosRequests, layerFilters, currentRole]);

  if (!webGlSupported) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-canvas text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-ink mb-2">
          WebGL Hardware Acceleration Unavailable
        </h3>
        <p className="text-sm text-ink-muted max-w-md mb-6 leading-relaxed">
          Your browser environment does not currently have WebGL active for MapLibre 3D rendering. You can continue using Neighbourlink via the accessible List View.
        </p>
      </div>
    );
  }

  const ctrl =
    "size-11 md:size-9 grid place-items-center text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-40";
  const chip = "nl-glass rounded-xl min-h-11 md:min-h-9 flex items-center gap-2 text-[12.5px] animate-rise";
  const chipBtn =
    "h-9 md:h-7 px-2.5 rounded-lg text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent-ink";
  const usingManual = !liveLocation && manualLocation;

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${pickingLocation ? "[&_canvas]:!cursor-crosshair" : ""}`}
    >
      {/* MapLibre DOM Target */}
      <div ref={mapContainer} className="w-full h-full" id="geospatial-map-canvas" />

      {/* Choose-on-map bar (form is hidden with its draft kept) */}
      {picking && (
        <div
          role="dialog"
          aria-label="Choose location"
          className="absolute z-40 left-3 right-3 bottom-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-6 md:w-[26rem] rounded-2xl border border-line bg-surface shadow-[var(--shadow-float)] p-4 animate-rise"
        >
          <p className="text-[15px] font-semibold text-ink">Choose location</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Tap the map or drag the pin to the exact spot.
          </p>
          {pickPos && (
            <p className="mt-1 font-mono text-[12px] text-ink-subtle" aria-live="polite">
              {pickPos.lat.toFixed(5)}, {pickPos.lng.toFixed(5)}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => finishPick(null)}
              className="h-11 px-4 rounded-lg border border-line text-[13.5px] font-medium text-ink hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              ref={confirmPickRef}
              onClick={() => finishPick(pickPos)}
              disabled={!pickPos}
              className="flex-1 h-11 rounded-lg bg-ink text-canvas text-[13.5px] font-medium disabled:opacity-50"
            >
              Confirm location
            </button>
          </div>
        </div>
      )}

      {/* Status (top-left): who's online, location, picking, 3D limitations */}
      <div className="absolute top-3 left-3 md:top-4 md:left-4 z-20 flex flex-col items-start gap-2 max-w-[calc(100%-5.5rem)] md:max-w-sm">
        {mapObj && !walk && !pickingLocation && (
          <MapPresence
            map={mapObj}
            name={currentUser.name}
            liveLocation={liveLocation}
            locationStatus={locationStatus}
            startLiveLocation={startLiveLocation}
          />
        )}

        {locationStatus === "requesting" && (
          <div className={`${chip} px-3 text-ink-muted`} role="status">
            <span className="size-3 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
            Finding your location…
            <button onClick={stopSharing} className={chipBtn}>
              Cancel
            </button>
          </div>
        )}

        {locationStatus === "active" && liveLocation && (
          <div className={`${chip} pl-3 pr-1 flex-wrap`} role="status">
            <span className="nl-live-dot text-accent" />
            <span className="font-medium text-ink">You</span>
            <span className="font-mono text-[11.5px] text-ink-subtle">
              {formatAccuracy(liveLocation.accuracy)}
            </span>
            <button
              onClick={() => setFollowMode(follow === "on" ? "off" : "on")}
              aria-pressed={follow === "on"}
              className={chipBtn}
              title={follow === "on" ? "Stop following" : "Keep the map centred on you"}
            >
              {follow === "on" ? "Following" : follow === "paused" ? "Resume follow" : "Follow"}
            </button>
            <button onClick={stopSharing} className={chipBtn}>
              Stop
            </button>
          </div>
        )}

        {(locationStatus === "denied" || locationStatus === "unavailable") && locationError && !pickingLocation && !usingManual && (
          <div className={`${chip} py-2 pl-3 pr-1 items-start flex-wrap`} role="status">
            <span className="mt-1.5 size-1.5 rounded-full bg-warn shrink-0" />
            <span className="flex-1 min-w-[12rem] text-ink-muted leading-snug py-0.5">{locationError}</span>
            <button onClick={() => void pickMyLocation()} className={chipBtn}>
              Set on map
            </button>
          </div>
        )}

        {usingManual && !pickingLocation && locationStatus !== "requesting" && (
          <div className={`${chip} pl-3 pr-1`} role="status">
            <span className="size-2 rounded-full bg-ink" />
            <span className="text-ink">Using the location you set</span>
            <button onClick={() => void pickMyLocation()} className={chipBtn}>
              Change
            </button>
            <button onClick={() => setManualLocation(null)} className={chipBtn}>
              Clear
            </button>
          </div>
        )}

        {is3D && mapLoaded && !capabilities.buildings && !walk && !drawerOpen && (
          <div className={`${chip} px-3 text-ink-muted`} role="status">
            3D buildings aren&apos;t available on this basemap
          </div>
        )}
      </div>

      {/* Empty viewport hint */}
      {visibleIncidentCount === 0 && mapLoaded && !pickingLocation && !walk && (
        <div className="absolute bottom-4 lg:bottom-auto lg:top-4 left-1/2 -translate-x-1/2 z-20 nl-glass rounded-full pl-4 pr-1.5 h-11 md:h-10 flex items-center gap-3 text-[13px] animate-rise whitespace-nowrap">
          <span className="text-ink-muted">No active reports in this view</span>
          <button
            onClick={fitToActiveIncidents}
            className="h-8 md:h-7 px-3 rounded-full bg-ink text-canvas text-[12px] font-medium flex items-center gap-1.5"
          >
            <Maximize2 className="size-3" /> Show all
          </button>
        </div>
      )}

      {/* Controls (top-right) */}
      <div
        className={`absolute top-3 right-3 md:top-4 z-30 flex flex-col items-end gap-2 transition-[right] duration-300 ${
          drawerOpen ? "md:right-[396px] lg:right-[436px]" : "md:right-4"
        }`}
      >
        <div className="flex gap-2">
          <MapTypePopover
            open={popover === "type"}
            onOpenChange={(o) => setPopover(o ? "type" : null)}
            isDark={isDark}
            is3D={is3D}
            capabilities={capabilities}
          />
          <LayersPopover
            open={popover === "layers"}
            onOpenChange={(o) => setPopover(o ? "layers" : null)}
            layerFilters={layerFilters}
            toggleLayer={toggleLayer}
            onFitAll={() => {
              fitToActiveIncidents();
              setPopover(null);
            }}
          />
        </div>

        <div className="nl-glass rounded-xl overflow-hidden flex flex-col divide-y divide-line">
          <button
            onClick={walk ? exitWalk : startWalk}
            disabled={!mapLoaded}
            aria-pressed={!!walk}
            aria-label={walk ? "Exit walk mode" : "Walk the map as a character"}
            title={walk ? "Exit walk mode" : "Walk mode"}
            className={`${ctrl} ${walk ? "!text-accent" : ""}`}
          >
            <Footprints className="size-4" />
          </button>
          <button
            onClick={locateMe}
            id="map-live-location-btn"
            aria-label={locationStatus === "active" ? "Centre on my location" : "Show my location"}
            title={locationStatus === "active" ? "Centre on my location" : "Show my location"}
            className={`${ctrl} ${locationStatus === "active" ? "!text-accent" : ""}`}
          >
            {locationStatus === "requesting" ? (
              <span className="size-3.5 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
            ) : (
              <Navigation
                className="size-4"
                fill={locationStatus === "active" && follow === "on" ? "currentColor" : "none"}
              />
            )}
          </button>
          <button
            onClick={toggle3D}
            id="map-3d-toggle-btn"
            aria-pressed={is3D}
            aria-label={is3D ? "Switch to 2D overhead view" : "Switch to 3D perspective"}
            title={is3D ? "Switch to 2D" : "Switch to 3D"}
            className={`${ctrl} font-mono text-[12px] font-semibold ${is3D ? "!text-accent" : ""}`}
          >
            {is3D ? "3D" : "2D"}
          </button>
          {(is3D || bearing !== 0) && (
            <button
              onClick={resetNorth}
              aria-label="Reset rotation to north"
              title="Reset to north"
              className={ctrl}
            >
              <Compass className="size-4" style={{ transform: `rotate(${-bearing - 45}deg)` }} />
            </button>
          )}
          {is3D && (
            <>
              <button onClick={() => rotateBy(-30)} aria-label="Rotate left" title="Rotate left" className={ctrl}>
                <RotateCcw className="size-4" />
              </button>
              <button onClick={() => rotateBy(30)} aria-label="Rotate right" title="Rotate right" className={ctrl}>
                <RotateCw className="size-4" />
              </button>
            </>
          )}
        </div>

        <div className="nl-glass rounded-xl overflow-hidden flex flex-col divide-y divide-line">
          <button onClick={() => map.current?.zoomIn()} aria-label="Zoom in" title="Zoom in" className={ctrl}>
            <Plus className="size-4" />
          </button>
          <button onClick={() => map.current?.zoomOut()} aria-label="Zoom out" title="Zoom out" className={ctrl}>
            <Minus className="size-4" />
          </button>
        </div>
      </div>

      <WalkStartDialog
        open={choosingWalkStart}
        onClose={() => setChoosingWalkStart(false)}
        onStart={beginWalk}
        mapCentre={mapCentre}
        defaultName={currentUser.name}
      />

      {walk && (
        <WalkMode
          map={walk.map}
          start={walk.start}
          pois={walkPois}
          onExit={exitWalk}
          onOpenDetails={openWalkDetails}
        />
      )}

      {/* Compact legend (desktop); on mobile the Map panel doubles as legend */}
      <div
        className={`absolute bottom-4 left-4 z-20 hidden items-center gap-4 nl-glass rounded-[10px] h-9 px-3.5 ${walk ? "" : "lg:flex"}`}
      >
        {MAP_LAYERS.filter((l) => layerFilters[l.key]).map((l) => (
          <span key={l.key} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span className={`size-2 rounded-full ${l.dot}`} />
            {l.short}
          </span>
        ))}
      </div>
    </div>
  );
}
