// MapLibre basemap styles with fallback tile endpoints and API key support
import type { StyleSpecification } from "maplibre-gl";

// Keyless fallback basemaps: Esri canvas base + label reference layers.
// (CARTO's public raster tiles now return "API key required" watermarks.)
const ESRI_CANVAS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const ESRI_CANVAS_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community";

// Source IDs differ per tone: setStyle() diffs by ID and would otherwise keep
// the old tiles when only the URL changes.
function esriCanvasStyle(tone: "Light" | "Dark"): StyleSpecification {
  const base = `esri-${tone.toLowerCase()}-base`;
  const labels = `esri-${tone.toLowerCase()}-labels`;
  return {
    version: 8,
    sources: {
      [base]: {
        type: "raster",
        tiles: [`${ESRI_CANVAS}/World_${tone}_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 16,
        attribution: ESRI_CANVAS_ATTRIBUTION,
      },
      [labels]: {
        type: "raster",
        tiles: [`${ESRI_CANVAS}/World_${tone}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 16,
      },
    },
    layers: [
      { id: `${base}-layer`, type: "raster", source: base },
      { id: `${labels}-layer`, type: "raster", source: labels },
    ],
  };
}

export const LIGHT_MAP_STYLE: StyleSpecification = esriCanvasStyle("Light");

export const DARK_MAP_STYLE: StyleSpecification = esriCanvasStyle("Dark");

export const SATELLITE_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    },
  },
  layers: [
    {
      id: "esri-satellite-layer",
      type: "raster",
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export type BasemapType = "street" | "satellite";

/** The MapTiler key in use (user override, then env), or null for a full style URL / none. */
export function getMapTilerKey(apiKeyOrUrl?: string | null): string | null {
  const input =
    apiKeyOrUrl?.trim() ||
    process.env.NEXT_PUBLIC_MAP_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();
  if (!input || /^https?:\/\//.test(input)) return null;
  return input;
}

/** MapTiler style IDs (verified against the configured key). */
export const MAPTILER_STYLES = {
  street: { light: "streets-v2", dark: "streets-v2-dark" },
  // Hybrid = satellite imagery + road/place labels. Labels can be hidden per
  // layer, so there is no separate "satellite" style switch.
  satellite: { light: "hybrid", dark: "hybrid" },
} as const;

/** Terrain-RGB DEM (Mapbox encoding), used only in 3D. */
export const terrainTileJsonUrl = (key: string) =>
  `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${key}`;

/**
 * Basemap style for the current theme and map type. Falls back to keyless
 * Esri raster tiles when no MapTiler key is configured.
 */
export function getMapStyle(
  isDark: boolean,
  apiKeyOrUrl?: string | null,
  basemapType: BasemapType = "street"
): StyleSpecification | string {
  const input = apiKeyOrUrl?.trim();
  // A full style URL is used as-is for street mode.
  if (input && /^https?:\/\//.test(input) && basemapType === "street") return input;

  const key = getMapTilerKey(apiKeyOrUrl);
  if (key) {
    const id = MAPTILER_STYLES[basemapType][isDark ? "dark" : "light"];
    return `https://api.maptiler.com/maps/${id}/style.json?key=${key}`;
  }

  if (basemapType === "satellite") return SATELLITE_FALLBACK_STYLE;
  return isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;
}
