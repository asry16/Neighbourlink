"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import { useTheme } from "next-themes";
import {
  Layers,
  Compass,
  Navigation,
  RotateCcw,
  RotateCw,
  AlertTriangle,
  Plus,
  Minus,
  Maximize2,
  Map as MapIcon,
  Satellite as SatelliteIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useDismiss } from "@/lib/use-dismiss";
import { getMapStyle, getMapTilerKey, LIGHT_MAP_STYLE, DARK_MAP_STYLE } from "@/lib/map-styles";
import { useMapApiKeyOverride } from "@/lib/map-key";
import { applyMapEnhancements, type MapCapabilities } from "./map-enhancements";
import {
  INITIAL_INCIDENTS,
  INITIAL_OFFICIAL_HAZARDS,
  INITIAL_RISK_ESTIMATES,
  INITIAL_HELP_CENTRES,
} from "@/lib/demo-data";
import { useDemo, type LayerFilters } from "@/context/demo-context";
import { humanize } from "@/components/ui/primitives";
import { HAZARD_TONE, INCIDENT_TONE, RISK_TONE, SOS_CATEGORY_LABEL, formatDateTime } from "@/lib/status";
import { esc, labelHTML, manualLocationHTML, pinHTML, popupHTML, sosAreaHTML, sosPinHTML, userLocationHTML } from "./marker-html";
import { formatAccuracy } from "@/lib/use-live-location";

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

const MAP_LAYERS: {
  key: keyof LayerFilters;
  label: string;
  short: string;
  dot: string;
  kind: string;
}[] = [
  { key: "officialHazards", label: "Official warnings", short: "Official", dot: "bg-orange-500", kind: "Issued by government agencies" },
  { key: "riskEstimates", label: "Flood risk", short: "Flood risk (experimental)", dot: "bg-indigo-500", kind: "Experimental estimate, not a warning" },
  { key: "communityReports", label: "Community reports", short: "Reports", dot: "bg-sky-500", kind: "Resident observations" },
  { key: "sosAreas", label: "SOS requests", short: "SOS", dot: "bg-red-500", kind: "Approximate areas for the public" },
  { key: "helpCentres", label: "Help centres", short: "Help centres", dot: "bg-emerald-500", kind: "Participating shelters and aid" },
];

interface GeospatialMapProps {
  onSelectIncident: (id: string) => void;
  onMapClickCoordinates?: (coords: { lat: number; lng: number }) => void;
}

export function GeospatialMap({
  onSelectIncident,
  onMapClickCoordinates,
}: GeospatialMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { resolvedTheme } = useTheme();

  const {
    currentLocality,
    layerFilters,
    toggleLayer,
    currentRole,
    selectedIncidentId,
    is3D,
    setIs3D,
    incidents,
    sosRequests,
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
  const [pickingLocation, setPickingLocation] = useState(false);
  const pickingRef = useRef(false);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [bearing, setBearing] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<MapCapabilities>({ buildings: false, terrain: false });
  const keyRejectedRef = useRef(false);
  const cameraSnapshotRef = useRef<maplibregl.JumpToOptions | null>(null);
  const appliedStyleRef = useRef<string | null>(null);
  const pendingFlyRef = useRef<maplibregl.FlyToOptions | null>(null);
  const [visibleIncidentCount, setVisibleIncidentCount] = useState<number | null>(null);

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
        sosRequests.forEach((s: any) => {
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
      setVisibleIncidentCount(count);
    } catch {
      // ignore
    }
  }, [layerFilters, incidents, sosRequests]);

  // Fit map viewport to encompass all active incidents, hazards, and SOS alerts
  const fitToActiveIncidents = useCallback(() => {
    if (!map.current) return;

    const coords: [number, number][] = [];

    if (layerFilters.communityReports) {
      incidents.forEach((i) => coords.push([i.longitude, i.latitude]));
    }
    if (layerFilters.sosAreas) {
      sosRequests.forEach((s: any) => {
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
  }, [layerFilters, incidents, sosRequests]);

  // Check WebGL support
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const supported = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
      setWebGlSupported(supported);
    } catch {
      setWebGlSupported(false);
    }
  }, []);

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
        setBearing(Math.round(m.getBearing()));
        setIs3D(m.getPitch() >= 20);
        updateVisibleCount();
      });

      m.on("rotate", () => setBearing(Math.round(m.getBearing())));
      // Perspective state follows the real camera (incl. two-finger tilt).
      m.on("pitchend", () => setIs3D(m.getPitch() >= 20));
      m.on("moveend", () => updateVisibleCountRef.current());

      m.on("click", (e) => {
        if (pickingRef.current) {
          setManualLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          setPickingLocation(false);
          return;
        }
        onMapClickCoordinates?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
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

  // Escape cancels "pick location on map".
  useEffect(() => {
    if (!pickingLocation) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPickingLocation(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickingLocation]);

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
            footer: `<button id="inspect-inc-${esc(inc.id)}" class="mt-3 w-full h-8 rounded-lg bg-ink text-canvas text-[12.5px] font-medium">Inspect &amp; corroborate</button>`,
          })
        );

        popup.on("open", () => {
          const btn = document.getElementById(`inspect-inc-${inc.id}`);
          if (btn) {
            btn.onclick = () => onSelectIncident(inc.id);
          }
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([inc.longitude, inc.latitude])
          .setPopup(popup)
          .addTo(map.current!);

        el.addEventListener("click", () => {
          onSelectIncident(inc.id);
        });

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
          })
        );

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
          })
        );

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

        const stat = (label: string, value: string) =>
          `<div><div class="nl-eyebrow !text-[9.5px]">${label}</div><div class="font-mono text-[12.5px] text-ink">${value}</div></div>`;

        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
          popupHTML({
            badge: `${humanize(risk.riskLevel)} risk · ${risk.horizonHours}h`,
            tone: RISK_TONE[risk.riskLevel],
            title: risk.localityName,
            body: esc(risk.explanation),
            footer: `
              <div class="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surface-2 p-2.5">
                ${stat("Rain 24h", `${risk.rainfallRecentMm ?? "—"} mm`)}
                ${stat("Forecast", `${risk.rainfallForecastMm ?? "—"} mm`)}
                ${stat("Gauge", `${risk.waterLevelMeters ?? "—"} m`)}
              </div>
              <p class="mt-2.5 text-[11.5px] text-ink-subtle">Experimental rule-based estimate, evaluated ${esc(formatDateTime(risk.evaluatedAt))} — not an official warning.</p>`,
          })
        );

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
            footer: `<div class="mt-3 flex flex-wrap gap-1">${hc.facilities
              .map(
                (f) =>
                  `<span class="h-5 px-1.5 rounded bg-surface-2 text-[12px] text-ink-muted inline-flex items-center">${esc(f)}</span>`
              )
              .join("")}</div>`,
          })
        );

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([hc.longitude, hc.latitude])
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
    onSelectIncident,
    incidents,
    sosRequests,
    updateVisibleCount,
  ]);

  // Re-run markers whenever layers or role changes
  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  // Handle selected incident, official hazard, risk estimate, or SOS flyTo
  useEffect(() => {
    if (!selectedIncidentId || !map.current || !mapLoaded) return;

    // 1. Check Community Incidents
    const incTarget = incidents.find((i) => i.id === selectedIncidentId);
    if (incTarget) {
      map.current.flyTo({
        center: [incTarget.longitude, incTarget.latitude],
        zoom: 16,
        essential: true,
        duration: 1200,
      });
      return;
    }

    // 2. Check Official Hazards
    const hazTarget = INITIAL_OFFICIAL_HAZARDS.find((h) => h.id === selectedIncidentId);
    if (hazTarget) {
      map.current.flyTo({
        center: [hazTarget.centerLng, hazTarget.centerLat],
        zoom: 15,
        essential: true,
        duration: 1200,
      });
      return;
    }

    // 3. Check Risk Estimates
    const riskTarget = INITIAL_RISK_ESTIMATES.find((r) => r.id === selectedIncidentId);
    if (riskTarget) {
      map.current.flyTo({
        center: [riskTarget.centerLng, riskTarget.centerLat],
        zoom: 15,
        essential: true,
        duration: 1200,
      });
      return;
    }

    // 4. Check SOS Requests
    const sosTarget = sosRequests.find((s: any) => s.id === selectedIncidentId);
    if (sosTarget) {
      const isResponder = currentRole === "RESPONDER" || currentRole === "ADMIN";
      const lng = isResponder
        ? sosTarget.exactLongitude || sosTarget.longitude
        : sosTarget.fuzzyLongitude || sosTarget.longitude;
      const lat = isResponder
        ? sosTarget.exactLatitude || sosTarget.latitude
        : sosTarget.fuzzyLatitude || sosTarget.latitude;
      if (lng && lat) {
        map.current.flyTo({
          center: [lng, lat],
          zoom: 16,
          essential: true,
          duration: 1200,
        });
      }
    }
    // Only re-fly when the selection changes, not when data or perspective does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIncidentId, mapLoaded]);

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

      {/* Status (top-left): location, picking, 3D limitations */}
      <div className="absolute top-3 left-3 md:top-4 md:left-4 z-20 flex flex-col items-start gap-2 max-w-[calc(100%-5.5rem)] md:max-w-sm">
        {pickingLocation && (
          <div className={`${chip} pl-3 pr-1`} role="status">
            <span className="text-ink">Tap the map to set your location</span>
            <button onClick={() => setPickingLocation(false)} className={chipBtn}>
              Cancel
            </button>
          </div>
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
            <button onClick={() => setPickingLocation(true)} className={chipBtn}>
              Set on map
            </button>
          </div>
        )}

        {usingManual && !pickingLocation && locationStatus !== "requesting" && (
          <div className={`${chip} pl-3 pr-1`} role="status">
            <span className="size-2 rounded-full bg-ink" />
            <span className="text-ink">Using the location you set</span>
            <button onClick={() => setPickingLocation(true)} className={chipBtn}>
              Change
            </button>
            <button onClick={() => setManualLocation(null)} className={chipBtn}>
              Clear
            </button>
          </div>
        )}

        {is3D && mapLoaded && !capabilities.buildings && (
          <div className={`${chip} px-3 text-ink-muted`} role="status">
            3D buildings aren&apos;t available on this basemap
          </div>
        )}
      </div>

      {/* Empty viewport hint */}
      {visibleIncidentCount === 0 && mapLoaded && !pickingLocation && (
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
      <div className="absolute top-3 right-3 md:top-4 md:right-4 z-30 flex flex-col items-end gap-2">
        <MapPanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          layerFilters={layerFilters}
          toggleLayer={toggleLayer}
          onFitAll={() => {
            fitToActiveIncidents();
            setPanelOpen(false);
          }}
          is3D={is3D}
          capabilities={capabilities}
        />

        <div className="nl-glass rounded-xl overflow-hidden flex flex-col divide-y divide-line">
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

      {/* Compact legend (desktop); on mobile the Map panel doubles as legend */}
      <div className="absolute bottom-4 left-4 z-20 hidden lg:flex items-center gap-4 nl-glass rounded-[10px] h-9 px-3.5">
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

/* --------------------------------------------------------------------------
   Map panel: map type, satellite labels, overlays. Popover on desktop,
   bottom sheet on mobile.
   -------------------------------------------------------------------------- */

function MapPanel({
  open,
  onOpenChange,
  layerFilters,
  toggleLayer,
  onFitAll,
  is3D,
  capabilities,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layerFilters: LayerFilters;
  toggleLayer: (key: keyof LayerFilters) => void;
  onFitAll: () => void;
  is3D: boolean;
  capabilities: MapCapabilities;
}) {
  const { basemapType, setBasemapType, satelliteLabels, setSatelliteLabels } = useDemo();
  const ref = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useDismiss([ref, sheetRef], open, close);
  const activeCount = Object.values(layerFilters).filter(Boolean).length;

  const switchRow = (on: boolean) =>
    `relative shrink-0 w-9 h-5 rounded-full transition-colors ${on ? "bg-accent" : "bg-surface-3"}`;
  const knob = (on: boolean) =>
    `absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${on ? "left-[18px]" : "left-0.5"}`;

  const body = (
    <>
            <div className="nl-eyebrow mb-2">Map type</div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Map type">
              {(
                [
                  { id: "street", label: "Street", icon: MapIcon },
                  { id: "satellite", label: "Satellite", icon: SatelliteIcon },
                ] as const
              ).map((t) => {
                const active = basemapType === t.id;
                return (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setBasemapType(t.id)}
                    className={`h-12 md:h-11 rounded-lg border flex items-center justify-center gap-2 text-[13px] font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    <t.icon className="size-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {basemapType === "satellite" && (
              <>
                <button
                  role="switch"
                  aria-checked={satelliteLabels}
                  onClick={() => setSatelliteLabels(!satelliteLabels)}
                  className="mt-2 w-full min-h-11 flex items-center gap-3 px-1 text-left"
                >
                  <span className="flex-1 text-[13px] text-ink">Road and place labels</span>
                  <span className={switchRow(satelliteLabels)}>
                    <span className={knob(satelliteLabels)} />
                  </span>
                </button>
                <p className="text-[11.5px] text-ink-subtle px-1">
                  Imagery is periodic, not live.
                </p>
              </>
            )}

            {is3D && (
              <p className="mt-3 text-[11.5px] leading-snug text-ink-subtle px-1">
                3D:{" "}
                {capabilities.buildings
                  ? "buildings from OpenStreetMap footprints (heights estimated where not recorded)"
                  : "no building data on this basemap"}
                {capabilities.terrain ? "; MapTiler terrain at true scale." : "."}
              </p>
            )}

            <div className="mt-4 mb-1 flex items-center justify-between">
              <span className="nl-eyebrow">Overlays</span>
              <button
                onClick={onFitAll}
                className="h-9 md:h-7 px-2 rounded-md text-[12px] font-medium text-accent-ink hover:bg-accent-soft flex items-center gap-1.5"
              >
                <Maximize2 className="size-3" /> Fit to active
              </button>
            </div>
            {MAP_LAYERS.map((layer) => {
              const on = layerFilters[layer.key];
              return (
                <button
                  key={layer.key}
                  role="switch"
                  aria-checked={on}
                  onClick={() => toggleLayer(layer.key)}
                  className="w-full min-h-11 md:min-h-10 flex items-center gap-3 px-1 rounded-lg hover:bg-surface-2 text-left"
                >
                  <span className={`size-2.5 rounded-full shrink-0 ${layer.dot} ${on ? "" : "opacity-30"}`} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13px] ${on ? "text-ink" : "text-ink-subtle"}`}>
                      {layer.label}
                    </span>
                    <span className="block text-[11.5px] text-ink-subtle">{layer.kind}</span>
                  </span>
                  <span className={switchRow(on)}>
                    <span className={knob(on)} />
                  </span>
                </button>
              );
            })}
    </>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        id="map-layers-toggle-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Map type and overlays"
        className={`nl-glass h-11 md:h-9 rounded-xl px-3 flex items-center gap-2 text-[13px] font-medium transition-colors ${
          open ? "text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        <Layers className="size-4" />
        <span className="hidden sm:inline">Map</span>
        <span className="font-mono text-[11px] text-ink-subtle">
          {activeCount}/{MAP_LAYERS.length}
        </span>
      </button>

      {open && (
        <>
          {/* Desktop: popover under the button */}
          <div
            role="dialog"
            aria-label="Map type and overlays"
            className="hidden md:block absolute z-50 right-0 top-full mt-2 w-80 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-xl bg-surface border border-line shadow-[var(--shadow-float)] p-3 animate-rise"
          >
            {body}
          </div>
          {/* Mobile: bottom sheet portalled above the bottom nav */}
          {createPortal(
            <div className="md:hidden">
              <div className="fixed inset-0 z-[60] bg-black/45" onClick={close} aria-hidden />
              <div
                ref={sheetRef}
                role="dialog"
                aria-modal="true"
                aria-label="Map type and overlays"
                className="fixed z-[61] inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-surface border-t border-line shadow-[var(--shadow-float)] px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-rise"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
                </div>
                {body}
                <button
                  onClick={close}
                  className="mt-3 w-full h-11 rounded-lg bg-surface-2 text-[14px] font-medium text-ink"
                >
                  Done
                </button>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
