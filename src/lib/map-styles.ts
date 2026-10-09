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

/**
 * Returns dynamic map style based on active theme, basemap type ('street' | 'satellite'),
 * and custom Map API Key or Style URL
 */
export function getMapStyle(
  isDark: boolean,
  apiKeyOrUrl?: string | null,
  basemapType: BasemapType = "street"
): StyleSpecification | string {
  const effectiveInput =
    apiKeyOrUrl?.trim() ||
    process.env.NEXT_PUBLIC_MAP_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();

  if (effectiveInput && effectiveInput.length > 0) {
    // If user provided a complete JSON style URL directly
    if (effectiveInput.startsWith("http://") || effectiveInput.startsWith("https://")) {
      return effectiveInput;
    }

    // Satellite / Aerial Hybrid mode (High-res imagery with place and road labels)
    if (basemapType === "satellite") {
      return `https://api.maptiler.com/maps/hybrid/style.json?key=${effectiveInput}`;
    }

    // Street mode: MapTiler's neutral "dataviz" styles keep the basemap quiet so
    // hazard markers carry the colour.
    return isDark
      ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${effectiveInput}`
      : `https://api.maptiler.com/maps/dataviz/style.json?key=${effectiveInput}`;
  }

  // Reliable open fallback when no key is set
  if (basemapType === "satellite") {
    return SATELLITE_FALLBACK_STYLE;
  }
  return isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;
}
