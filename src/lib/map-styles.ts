// MapLibre basemap styles with fallback tile endpoints and API key support
import type { StyleSpecification } from "maplibre-gl";

export const LIGHT_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "carto-light": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto-light-layer",
      type: "raster",
      source: "carto-light",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

export const DARK_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto-dark-layer",
      type: "raster",
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 20,
      paint: {
        "raster-contrast": 0.1,
        "raster-brightness-min": 0.08,
        "raster-brightness-max": 0.92,
      },
    },
  ],
};

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
 * Basemap style for the current theme and map type. Falls back to open CARTO
 * / Esri raster tiles when no MapTiler key is configured.
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
