"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import { useTheme } from "next-themes";
import {
  Layers,
  Compass,
  Navigation,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  AlertTriangle,
  FileText,
  LifeBuoy,
  Building2,
  TrendingUp,
  MapPin,
  CheckCircle,
  HelpCircle,
  Key,
  ExternalLink,
  X,
  Check,
  Maximize2,
} from "lucide-react";
import { getMapStyle, LIGHT_MAP_STYLE, DARK_MAP_STYLE } from "@/lib/map-styles";
import {
  INITIAL_INCIDENTS,
  INITIAL_OFFICIAL_HAZARDS,
  INITIAL_RISK_ESTIMATES,
  INITIAL_SOS_REQUESTS,
  INITIAL_HELP_CENTRES,
  type DemoIncident,
} from "@/lib/demo-data";
import { useDemo, type LayerFilters } from "@/context/demo-context";
import { humanize } from "@/components/ui/primitives";
import { HAZARD_TONE, INCIDENT_TONE, RISK_TONE, SOS_CATEGORY_LABEL } from "@/lib/status";
import { esc, labelHTML, pinHTML, popupHTML, sosAreaHTML, sosPinHTML, userLocationHTML } from "./marker-html";
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

const MAP_LAYERS: {
  key: keyof LayerFilters;
  label: string;
  short: string;
  dot: string;
}[] = [
  { key: "officialHazards", label: "Official hazards", short: "Official", dot: "bg-orange-500" },
  { key: "riskEstimates", label: "Flood-risk estimates", short: "Flood risk", dot: "bg-indigo-500" },
  { key: "communityReports", label: "Community reports", short: "Reports", dot: "bg-sky-500" },
  { key: "sosAreas", label: "SOS areas", short: "SOS", dot: "bg-red-500" },
  { key: "helpCentres", label: "Help centres", short: "Help", dot: "bg-emerald-500" },
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
  } = useDemo();
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Follow mode: camera tracks the user until they pan the map themselves.
  const [following, setFollowing] = useState(false);
  const hasCenteredRef = useRef(false);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [mapApiKey, setMapApiKey] = useState<string>("");
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState("");
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

  // Load saved API key from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("neighbourlink_map_api_key");
      if (savedKey) {
        setMapApiKey(savedKey);
        setTempKeyInput(savedKey);
      }
    }
  }, []);

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

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || map.current || !webGlSupported) return;

    // Explicitly configure worker URL to prevent Next.js Turbopack blob loader error
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      maplibregl.setWorkerUrl(`${origin}/maplibre-gl-worker.js`);
    } catch (e) {
      console.warn("MapLibre workerUrl setup note:", e);
    }

    const isDark = resolvedTheme === "dark";
    const initialStyle = getMapStyle(isDark, mapApiKey);

    try {
      const m = new maplibregl.Map({
        container: mapContainer.current,
        style: initialStyle,
        center: [currentLocality.lng, currentLocality.lat],
        zoom: currentLocality.zoom,
        pitch: is3D ? 55 : 0,
        bearing: is3D ? -20 : 0,
        attributionControl: false,
      });

      // Defensive fallback if remote custom style fails (e.g. invalid key or network error)
      m.on("error", (e) => {
        const errorMsg = e?.error?.message || "";
        if (
          errorMsg.includes("403") ||
          errorMsg.includes("401") ||
          errorMsg.includes("Forbidden") ||
          errorMsg.includes("Unauthorized")
        ) {
          console.warn("Custom map style access error. Reverting to local CARTO fallback:", errorMsg);
          const fallbackStyle = resolvedTheme === "dark" ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;
          m.setStyle(fallbackStyle);
        }
      });

      // Add default attribution control at bottom right
      // Tile sources carry their own attribution; start collapsed so it
      // doesn't cover the map on small screens.
      const attribution = new maplibregl.AttributionControl({ compact: true });
      m.addControl(attribution, "bottom-right");
      m.once("load", () =>
        m.getContainer()
          .querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show")
      );

      m.on("load", () => {
        setMapLoaded(true);
        const curPitch = Math.round(m.getPitch());
        const curBearing = Math.round(m.getBearing());
        setPitch(curPitch);
        setBearing(curBearing);
        setIs3D(curPitch >= 20);
        updateVisibleCount();
      });

      m.on("rotate", () => {
        setBearing(Math.round(m.getBearing()));
      });

      m.on("pitch", () => {
        setPitch(Math.round(m.getPitch()));
      });

      m.on("pitchend", () => {
        const curPitch = Math.round(m.getPitch());
        setPitch(curPitch);
        setIs3D(curPitch >= 20);
      });

      m.on("move", () => {
        setBearing(Math.round(m.getBearing()));
        setPitch(Math.round(m.getPitch()));
      });

      m.on("moveend", () => {
        updateVisibleCount();
      });

      m.on("click", (e) => {
        if (onMapClickCoordinates) {
          onMapClickCoordinates({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        }
      });

      map.current = m;
    } catch (err) {
      console.error("MapLibre initialization failed:", err);
      setWebGlSupported(false);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [webGlSupported]); // Only run on mount or webgl state

  // Handle Theme and API Key Style Switch Preserving Viewport
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const currentCenter = map.current.getCenter();
    const currentZoom = map.current.getZoom();
    const currentPitch = map.current.getPitch();
    const currentBearing = map.current.getBearing();

    const isDark = resolvedTheme === "dark";
    const targetStyle = getMapStyle(isDark, mapApiKey);

    map.current.setStyle(targetStyle);

    // After style loads, restore position, camera pitch/bearing, and re-render markers
    map.current.once("style.load", () => {
      if (!map.current) return;
      map.current.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        pitch: currentPitch,
        bearing: currentBearing,
      });
      setPitch(Math.round(currentPitch));
      setBearing(Math.round(currentBearing));
      setIs3D(currentPitch >= 20);
      renderMarkers();
      updateVisibleCount();
    });
  }, [resolvedTheme, mapApiKey, mapLoaded, updateVisibleCount]);

  // Handle Locality change with flyTo
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.flyTo({
      center: [currentLocality.lng, currentLocality.lat],
      zoom: currentLocality.zoom,
      essential: true,
      duration: 1800,
    });
  }, [currentLocality, mapLoaded]);

  // Toggle 2D / 3D Mode based on actual camera state
  const toggle3D = useCallback(() => {
    if (!map.current) return;
    const currentPitch = map.current.getPitch();
    const willBe3D = currentPitch < 20;
    setIs3D(willBe3D);

    if (willBe3D) {
      map.current.easeTo({
        pitch: 55,
        bearing: -20,
        duration: 1000,
      });
    } else {
      map.current.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
      });
    }
  }, [setIs3D]);

  // Reset North
  const resetNorth = () => {
    if (!map.current) return;
    map.current.easeTo({ bearing: 0, pitch: is3D ? 55 : 0, duration: 600 });
  };

  // Live location: off → start tracking & follow; tracking but panned away →
  // recentre & follow; following → stop sharing.
  const locateMe = () => {
    if (locationStatus === "active" && liveLocation) {
      if (following) {
        stopLiveLocation();
        setFollowing(false);
        return;
      }
      setFollowing(true);
      map.current?.easeTo({
        center: [liveLocation.lng, liveLocation.lat],
        zoom: Math.max(map.current.getZoom(), 15),
        duration: 900,
      });
      return;
    }
    hasCenteredRef.current = false;
    setFollowing(true);
    startLiveLocation();
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

    if (following) {
      const firstFix = !hasCenteredRef.current;
      hasCenteredRef.current = true;
      m.easeTo({
        center: [lng, lat],
        zoom: firstFix ? Math.max(m.getZoom(), 15) : m.getZoom(),
        duration: firstFix ? 1200 : 600,
      });
    }
  }, [liveLocation, mapLoaded, following]);

  // Accuracy ring is in metres, so resize it as the zoom changes; a manual
  // pan ends follow mode.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;
    const onZoom = () => {
      const el = userMarkerRef.current?.getElement();
      if (el) sizeAccuracyRing(el, m.getZoom());
    };
    const onDragStart = () => setFollowing(false);
    m.on("zoom", onZoom);
    m.on("dragstart", onDragStart);
    return () => {
      m.off("zoom", onZoom);
      m.off("dragstart", onDragStart);
    };
  }, [mapLoaded]);

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
            meta: `${esc(inc.localityName)} · ${inc.observationCount} observation${inc.observationCount === 1 ? "" : "s"}`,
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
            meta: esc(haz.source),
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
              <p class="mt-2.5 text-[11.5px] text-ink-subtle">Experimental rule-based estimate — not an official warning.</p>`,
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
        pitch: is3D ? 55 : 0,
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
        pitch: is3D ? 55 : 0,
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
        pitch: is3D ? 55 : 0,
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
          pitch: is3D ? 55 : 0,
          essential: true,
          duration: 1200,
        });
      }
    }
  }, [selectedIncidentId, mapLoaded, is3D, incidents, sosRequests, currentRole]);

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
    "size-9 grid place-items-center text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors";

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* MapLibre DOM Target */}
      <div ref={mapContainer} className="w-full h-full" id="geospatial-map-canvas" />

      {/* Empty viewport hint */}
      {visibleIncidentCount === 0 && mapLoaded && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 nl-glass rounded-full pl-4 pr-1.5 h-10 flex items-center gap-3 text-[13px] animate-rise">
          <span className="nl-live-dot text-warn" />
          <span className="text-ink-muted">Nothing active in this view</span>
          <button
            onClick={fitToActiveIncidents}
            className="h-7 px-3 rounded-full bg-ink text-canvas text-[12px] font-medium flex items-center gap-1.5"
          >
            <Maximize2 className="size-3" /> Show all
          </button>
        </div>
      )}

      <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2 max-w-[calc(100%-8rem)]">
        {/* Live location status */}
        {locationStatus === "active" && liveLocation && (
          <div className="nl-glass rounded-lg h-9 pl-3 pr-1 flex items-center gap-2.5 animate-rise">
            <span className="nl-live-dot text-accent" />
            <span className="text-[12.5px] font-medium text-ink">Live location</span>
            <span className="font-mono text-[11.5px] text-ink-subtle">
              {formatAccuracy(liveLocation.accuracy)}
            </span>
            <button
              onClick={() => {
                stopLiveLocation();
                setFollowing(false);
              }}
              className="h-7 px-2 rounded-md text-[12px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              Stop
            </button>
          </div>
        )}
        {locationStatus === "requesting" && (
          <div className="nl-glass rounded-lg h-9 px-3 flex items-center gap-2.5 text-[12.5px] text-ink-muted animate-rise">
            <span className="size-3 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
            Finding your location…
          </div>
        )}
        {(locationStatus === "denied" || locationStatus === "unavailable") && locationError && (
          <div className="nl-glass rounded-lg min-h-9 py-2 px-3 flex items-start gap-2 text-[12.5px] text-ink-muted max-w-xs animate-rise">
            <span className="mt-1 size-1.5 rounded-full bg-warn shrink-0" />
            {locationError}
          </div>
        )}

        {/* 3D readout */}
        {is3D && (
          <div className="nl-glass rounded-lg h-9 px-3 flex items-center gap-2.5 animate-rise">
            <Compass className="size-4 text-accent" style={{ transform: `rotate(${-bearing}deg)` }} />
            <span className="text-[12.5px] font-medium text-ink">3D</span>
            <span className="font-mono text-[11.5px] text-ink-subtle">
              {pitch}° pitch · {bearing}° bearing
            </span>
          </div>
        )}
      </div>

      {/* Controls (top-right), grouped by purpose */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="relative">
          <button
            onClick={() => setLayersMenuOpen(!layersMenuOpen)}
            id="map-layers-toggle-btn"
            aria-expanded={layersMenuOpen}
            className={`nl-glass h-9 rounded-[10px] pl-2.5 pr-3 flex items-center gap-2 text-[12.5px] font-medium transition-colors ${
              layersMenuOpen ? "text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Layers className="size-4" />
            Layers
            <span className="font-mono text-[12px] text-ink-subtle">
              {Object.values(layerFilters).filter(Boolean).length}/{MAP_LAYERS.length}
            </span>
          </button>

          {layersMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface border border-line shadow-[var(--shadow-float)] p-1.5 z-30 animate-rise">
              <div className="nl-eyebrow px-2.5 pt-1.5 pb-2">Show on map</div>
              {MAP_LAYERS.map((layer) => {
                const on = layerFilters[layer.key];
                return (
                  <button
                    key={layer.key}
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggleLayer(layer.key)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-2 text-left"
                  >
                    <span className={`size-2.5 rounded-full ${layer.dot} ${on ? "" : "opacity-30"}`} />
                    <span className={`flex-1 text-[13px] ${on ? "text-ink" : "text-ink-subtle"}`}>
                      {layer.label}
                    </span>
                    <span
                      className={`relative w-7 h-4 rounded-full transition-colors ${
                        on ? "bg-accent" : "bg-surface-3"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-[left] ${
                          on ? "left-3.5" : "left-0.5"
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="nl-glass rounded-[10px] overflow-hidden flex flex-col divide-y divide-line">
          <button
            onClick={toggle3D}
            id="map-3d-toggle-btn"
            title="Toggle 3D perspective"
            aria-pressed={is3D}
            className={`${ctrl} font-mono text-[11.5px] font-semibold ${is3D ? "!text-accent" : ""}`}
          >
            {is3D ? "3D" : "2D"}
          </button>
          <button onClick={resetNorth} className={ctrl} title="Reset bearing (north up)">
            <Compass className="size-4" style={{ transform: `rotate(${-bearing}deg)` }} />
          </button>
          <button
            onClick={locateMe}
            id="map-live-location-btn"
            aria-pressed={locationStatus === "active"}
            title={
              locationStatus === "active"
                ? following
                  ? "Stop sharing live location"
                  : "Recentre on my location"
                : "Show my live location"
            }
            className={`${ctrl} ${locationStatus === "active" ? "!text-accent" : ""}`}
          >
            {locationStatus === "requesting" ? (
              <span className="size-3.5 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
            ) : (
              <Navigation
                className="size-4"
                fill={locationStatus === "active" && following ? "currentColor" : "none"}
              />
            )}
          </button>
          <button
            onClick={fitToActiveIncidents}
            id="map-fit-incidents-btn"
            className={ctrl}
            title="Fit to active incidents"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>

        <div className="nl-glass rounded-[10px] overflow-hidden flex flex-col divide-y divide-line">
          <button onClick={() => map.current?.zoomIn()} className={ctrl} title="Zoom in">
            <ZoomIn className="size-4" />
          </button>
          <button onClick={() => map.current?.zoomOut()} className={ctrl} title="Zoom out">
            <ZoomOut className="size-4" />
          </button>
        </div>

        <button
          onClick={() => {
            setTempKeyInput(mapApiKey);
            setApiKeyModalOpen(true);
          }}
          id="map-api-key-btn"
          className={`nl-glass relative size-9 rounded-[10px] grid place-items-center transition-colors ${
            mapApiKey ? "text-warn" : "text-ink-muted hover:text-ink"
          }`}
          title="Basemap provider settings"
        >
          <Key className="size-4" />
          {mapApiKey && (
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-warn" />
          )}
        </button>
      </div>

      {/* Legend (bottom-left) */}
      <div className="absolute bottom-4 left-4 z-20 hidden lg:flex items-center gap-4 nl-glass rounded-[10px] h-9 px-3.5">
        {MAP_LAYERS.filter((l) => layerFilters[l.key]).map((l) => (
          <span key={l.key} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span className={`size-2 rounded-full ${l.dot}`} />
            {l.short}
          </span>
        ))}
      </div>

      {/* Map API Key Configuration Modal */}
      {apiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-rise">
          <div className="bg-surface border border-line rounded-2xl shadow-[var(--shadow-float)] max-w-md w-full p-6 text-ink space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Map Provider & API Key</h3>
                  <p className="text-[12.5px] text-ink-subtle">
                    Configure basemap styling & vector tiles
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApiKeyModalOpen(false)}
                className="p-1.5 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current status info */}
            <div className="p-3.5 rounded-2xl bg-surface-2 border border-line text-[12.5px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-muted">Active Basemap:</span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${
                    mapApiKey
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}
                >
                  <Check className="w-3 h-3" />
                  {mapApiKey ? "MapTiler / Vector Key Active" : "CARTO Open Basemap (Free)"}
                </span>
              </div>
              <p className="text-ink-subtle text-[12px] leading-relaxed">
                {mapApiKey
                  ? "Your custom API key is active for high-resolution vector styles."
                  : "No key is required by default! Neighbourlink renders open-source CARTO Positron & Dark Matter tiles out-of-the-box. Enter your MapTiler key or style URL below anytime for enhanced vector detail."}
              </p>
            </div>

            {/* Key Input */}
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-ink-muted block">
                MapTiler API Key or Vector Style JSON URL
              </label>
              <input
                type="text"
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder="e.g. your_maptiler_api_key or https://.../style.json"
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-white dark:bg-slate-800 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-sky-500 text-ink"
              />
              <div className="text-[12px] text-ink-subtle flex items-center justify-between pt-1">
                <span>Free MapTiler keys at</span>
                <a
                  href="https://cloud.maptiler.com/account/keys/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-500 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  cloud.maptiler.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {mapApiKey ? (
                <button
                  onClick={() => {
                    setTempKeyInput("");
                    setMapApiKey("");
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("neighbourlink_map_api_key");
                    }
                    setApiKeyModalOpen(false);
                  }}
                  className="text-[12.5px] text-red-500 hover:text-red-600 dark:hover:text-red-400 font-semibold cursor-pointer"
                >
                  Reset to Free Basemap
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setApiKeyModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const cleaned = tempKeyInput.trim();
                    setMapApiKey(cleaned);
                    if (typeof window !== "undefined") {
                      if (cleaned) {
                        localStorage.setItem("neighbourlink_map_api_key", cleaned);
                      } else {
                        localStorage.removeItem("neighbourlink_map_api_key");
                      }
                    }
                    setApiKeyModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-[12.5px] font-semibold text-canvas bg-ink hover:opacity-90 shadow-md cursor-pointer"
                >
                  Apply Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
