import type { Map as MapLibreMap } from "maplibre-gl";
import { terrainTileJsonUrl, type BasemapType } from "@/lib/map-styles";

/**
 * Layers and sources Neighbourlink adds on top of a provider basemap.
 *
 * `setStyle()` wipes custom sources/layers, so these are re-applied from a
 * single `style.load` handler. Every step is idempotent (checks before adding)
 * so rapid theme/basemap switching cannot create duplicates.
 */

export const BUILDINGS_LAYER = "nl-buildings-3d";
export const TERRAIN_SOURCE = "nl-terrain";

/** OpenMapTiles-schema vector source present in every MapTiler style we use. */
const VECTOR_SOURCE = "maptiler_planet";

export interface EnhancementOptions {
  is3D: boolean;
  isDark: boolean;
  basemap: BasemapType;
  showLabels: boolean;
  mapTilerKey: string | null;
}

export interface MapCapabilities {
  buildings: boolean;
  terrain: boolean;
}

export function applyMapEnhancements(map: MapLibreMap, opts: EnhancementOptions): MapCapabilities {
  const style = map.getStyle();
  if (!style) return { buildings: false, terrain: false };

  const hasVector = Boolean(map.getSource(VECTOR_SOURCE));

  // --- Labels (satellite only; street labels are always on) ---------------
  if (opts.basemap === "satellite") {
    for (const layer of style.layers) {
      if (layer.type === "symbol" || layer.type === "line") {
        map.setLayoutProperty(layer.id, "visibility", opts.showLabels ? "visible" : "none");
      }
    }
  }

  // --- 3D buildings ---------------------------------------------------------
  // Real footprints from the OpenMapTiles `building` layer. Heights come from
  // `render_height` / `render_min_height`; the provider already derives these
  // from OSM height or levels and applies its own conservative default when a
  // building has neither. Parts flagged `hide_3d` are excluded.
  if (hasVector) {
    // Hide the style's own extrusion layer so buildings are never drawn twice.
    for (const layer of style.layers) {
      if (
        layer.type === "fill-extrusion" &&
        layer.id !== BUILDINGS_LAYER &&
        "source-layer" in layer &&
        layer["source-layer"] === "building"
      ) {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    }

    if (!map.getLayer(BUILDINGS_LAYER)) {
      const firstSymbol = style.layers.find((l) => l.type === "symbol")?.id;
      map.addLayer(
        {
          id: BUILDINGS_LAYER,
          type: "fill-extrusion",
          source: VECTOR_SOURCE,
          "source-layer": "building",
          minzoom: 14,
          filter: ["!", ["has", "hide_3d"]],
          paint: {
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            // Fade in between z14 and z15 so tiles don't pop.
            "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.85],
          },
        },
        // Insert beneath labels so place names stay readable.
        firstSymbol
      );
    }

    const colour =
      opts.basemap === "satellite"
        ? "#d9d6cf"
        : opts.isDark
          ? "#3a4150"
          : "#dcd8d0";
    map.setPaintProperty(BUILDINGS_LAYER, "fill-extrusion-color", colour);
    map.setPaintProperty(
      BUILDINGS_LAYER,
      "fill-extrusion-opacity",
      ["interpolate", ["linear"], ["zoom"], 14, 0, 15, opts.basemap === "satellite" ? 0.55 : 0.85]
    );
    map.setLayoutProperty(BUILDINGS_LAYER, "visibility", opts.is3D ? "visible" : "none");
  }

  // --- Terrain --------------------------------------------------------------
  // MapTiler terrain-rgb-v2 (Mapbox encoding). Exaggeration stays at 1.0:
  // Kolkata is a flat delta and any boost would invent relief.
  let terrain = false;
  if (opts.mapTilerKey) {
    if (!map.getSource(TERRAIN_SOURCE)) {
      map.addSource(TERRAIN_SOURCE, {
        type: "raster-dem",
        url: terrainTileJsonUrl(opts.mapTilerKey),
        encoding: "mapbox",
        tileSize: 256,
      });
    }
    map.setTerrain(opts.is3D ? { source: TERRAIN_SOURCE, exaggeration: 1 } : null);
    terrain = true;
  } else if (map.getTerrain()) {
    map.setTerrain(null);
  }

  return { buildings: hasVector, terrain };
}
