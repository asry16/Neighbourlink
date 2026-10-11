import type {
  AlertLevel,
  FeedStatus,
  HazardRegion,
  LiveHazard,
  LiveHazardType,
  LiveHazardsResponse,
} from "@/lib/live-types";
import { isInIndia } from "@/lib/geo-india";

/** India and immediate neighbourhood (quakes there are felt across the north). */
const INDIA_BBOX = { minLat: 6, maxLat: 37.5, minLng: 67, maxLng: 98 };
const CACHE_TTL_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 3600 * 1000;
/** India's region in detail; elsewhere only significant quakes. */
const INDIA_MIN_MAGNITUDE = 2.5;
const WORLD_MIN_MAGNITUDE = 5;

let cache: { at: number; data: LiveHazardsResponse } | null = null;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}

function regionOf(lat: number, lng: number): HazardRegion {
  if (isInIndia(lat, lng)) return "INDIA";
  const b = INDIA_BBOX;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng ? "NEAR_INDIA" : "WORLD";
}

type UsgsFeature = {
  id: string;
  properties: { mag: number; place: string; time: number; url: string; alert?: string | null };
  geometry: { coordinates: [number, number, number] };
};

async function usgsQuery(params: string): Promise<LiveHazard[]> {
  const url =
    "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=200" +
    `&starttime=${isoDay(new Date(Date.now() - 7 * DAY_MS))}${params}`;
  const json = await fetchJson(url);
  return ((json.features ?? []) as UsgsFeature[]).map((f): LiveHazard => {
    const p = f.properties;
    const [lng, lat, depth] = f.geometry.coordinates;
    const alert = p.alert?.toUpperCase();
    return {
      id: `usgs-${f.id}`,
      source: "USGS",
      type: "EARTHQUAKE",
      title: `M${p.mag.toFixed(1)} earthquake`,
      detail: `${p.place} · ${Math.round(depth)} km deep`,
      alertLevel: alert === "GREEN" || alert === "ORANGE" || alert === "RED" ? alert : null,
      magnitude: p.mag,
      latitude: lat,
      longitude: lng,
      startedAt: new Date(p.time).toISOString(),
      endedAt: null,
      isCurrent: Date.now() - p.time < DAY_MS,
      region: regionOf(lat, lng),
      url: p.url,
    };
  });
}

/** USGS, last 7 days: M2.5+ around India, M5+ worldwide. */
async function usgsEarthquakes(): Promise<LiveHazard[]> {
  const b = INDIA_BBOX;
  const [india, world] = await Promise.all([
    usgsQuery(
      `&minmagnitude=${INDIA_MIN_MAGNITUDE}&minlatitude=${b.minLat}&maxlatitude=${b.maxLat}` +
        `&minlongitude=${b.minLng}&maxlongitude=${b.maxLng}`
    ),
    usgsQuery(`&minmagnitude=${WORLD_MIN_MAGNITUDE}`),
  ]);
  return [...india, ...world];
}

const GDACS_TYPE: Record<string, LiveHazardType> = {
  EQ: "EARTHQUAKE",
  TC: "CYCLONE",
  FL: "FLOOD",
  DR: "DROUGHT",
  WF: "WILDFIRE",
  VO: "VOLCANO",
};

type GdacsFeature = {
  geometry?: { type: string; coordinates: [number, number] };
  properties: {
    eventtype: string;
    eventid: number;
    episodeid: number;
    name: string;
    country?: string;
    alertlevel?: string;
    fromdate: string;
    todate?: string;
    iscurrent?: string;
    url?: { report?: string };
    severitydata?: { severitytext?: string };
  };
};

async function gdacsQuery(params: string, forceIndia: boolean): Promise<LiveHazard[]> {
  const url =
    `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?${params}` +
    `&fromDate=${isoDay(new Date(Date.now() - 30 * DAY_MS))}&toDate=${isoDay(new Date())}`;
  const json = await fetchJson(url);
  return ((json.features ?? []) as GdacsFeature[])
    .filter((f) => f.geometry?.type === "Point")
    .map((f): LiveHazard => {
      const p = f.properties;
      const [lng, lat] = f.geometry!.coordinates;
      const level = p.alertlevel?.toUpperCase();
      const started = new Date(`${p.fromdate}Z`);
      return {
        id: `gdacs-${p.eventtype}-${p.eventid}-${p.episodeid}`,
        source: "GDACS",
        type: GDACS_TYPE[p.eventtype] ?? "OTHER",
        title: p.name,
        // GDACS reports floods as "Magnitude 0"; the alert level says more.
        detail:
          p.severitydata?.severitytext && !/magnitude 0\b/i.test(p.severitydata.severitytext)
            ? p.severitydata.severitytext
            : `${p.alertlevel ?? "Unrated"} alert · ${started.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        alertLevel: level === "GREEN" || level === "ORANGE" || level === "RED" ? level : null,
        latitude: lat,
        longitude: lng,
        startedAt: started.toISOString(),
        endedAt: p.todate ? new Date(`${p.todate}Z`).toISOString() : null,
        isCurrent: p.iscurrent === "true",
        // A cyclone's centroid can sit at sea; GDACS's country list is authoritative.
        region: forceIndia ? "INDIA" : regionOf(lat, lng),
        url: p.url?.report ?? `https://www.gdacs.org/report.aspx?eventtype=${p.eventtype}&eventid=${p.eventid}`,
      };
    });
}

/** GDACS (UN / EU), last 30 days: everything affecting India, Orange/Red worldwide. */
async function gdacsEvents(): Promise<LiveHazard[]> {
  const [india, world] = await Promise.all([
    gdacsQuery("country=India", true),
    gdacsQuery("alertlevel=orange;red", false),
  ]);
  return [...india, ...world];
}

const ALERT_RANK: Record<string, number> = { RED: 3, ORANGE: 2, GREEN: 1 };
const REGION_RANK: Record<HazardRegion, number> = { INDIA: 2, NEAR_INDIA: 1, WORLD: 0 };

export class LiveFeedsService {
  /** Real events from USGS and GDACS, India first. Each feed fails independently. */
  static async getHazards(): Promise<LiveHazardsResponse> {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

    const feeds = [
      { name: "USGS" as const, run: usgsEarthquakes },
      { name: "GDACS" as const, run: gdacsEvents },
    ];
    const settled = await Promise.allSettled(feeds.map((f) => f.run()));

    // India queries come first, so a duplicate keeps its India tagging.
    const byId = new Map<string, LiveHazard>();
    const sources: FeedStatus[] = settled.map((r, i) => {
      if (r.status === "fulfilled") {
        for (const h of r.value) if (!byId.has(h.id)) byId.set(h.id, h);
        return { name: feeds[i].name, ok: true, count: r.value.length };
      }
      console.error(`${feeds[i].name} feed failed:`, r.reason);
      return { name: feeds[i].name, ok: false, count: 0, error: String(r.reason?.message ?? r.reason) };
    });

    // Current first, then India, then alert level, then most recent.
    const hazards = [...byId.values()].sort(
      (a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) ||
        REGION_RANK[b.region] - REGION_RANK[a.region] ||
        (ALERT_RANK[b.alertLevel ?? ""] ?? 0) - (ALERT_RANK[a.alertLevel ?? ""] ?? 0) ||
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    sources.forEach((s) => (s.count = hazards.filter((h) => h.source === s.name).length));

    const data: LiveHazardsResponse = { hazards, sources, fetchedAt: new Date().toISOString() };
    // Don't pin a total outage in the cache.
    if (sources.some((s) => s.ok)) cache = { at: Date.now(), data };
    return data;
  }
}
