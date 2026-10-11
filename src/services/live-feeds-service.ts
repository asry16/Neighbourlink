import type { AlertLevel, FeedStatus, LiveHazard, LiveHazardType, LiveHazardsResponse } from "@/lib/live-types";

/** India and immediate neighbourhood (quakes there are felt across the north). */
const INDIA_BBOX = { minLat: 6, maxLat: 37.5, minLng: 67, maxLng: 98 };
const CACHE_TTL_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 3600 * 1000;

let cache: { at: number; data: LiveHazardsResponse } | null = null;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}

/** USGS: magnitude 2.5+ earthquakes in the region over the last 7 days. */
async function usgsEarthquakes(): Promise<LiveHazard[]> {
  const b = INDIA_BBOX;
  const url =
    "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=60&minmagnitude=2.5" +
    `&starttime=${isoDay(new Date(Date.now() - 7 * DAY_MS))}` +
    `&minlatitude=${b.minLat}&maxlatitude=${b.maxLat}&minlongitude=${b.minLng}&maxlongitude=${b.maxLng}`;
  const json = await fetchJson(url);
  return (json.features ?? []).map(
    (f: {
      id: string;
      properties: { mag: number; place: string; time: number; url: string; alert?: string | null };
      geometry: { coordinates: [number, number, number] };
    }): LiveHazard => {
      const p = f.properties;
      const [lng, lat, depth] = f.geometry.coordinates;
      const alert = p.alert ? (p.alert.toUpperCase() as AlertLevel) : null;
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
        url: p.url,
      };
    }
  );
}

const GDACS_TYPE: Record<string, LiveHazardType> = {
  EQ: "EARTHQUAKE",
  TC: "CYCLONE",
  FL: "FLOOD",
  DR: "DROUGHT",
  WF: "WILDFIRE",
  VO: "VOLCANO",
};

/** GDACS (UN / EU): cyclones, floods, droughts etc. affecting India, last 30 days. */
async function gdacsEvents(): Promise<LiveHazard[]> {
  const url =
    "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?country=India" +
    `&fromDate=${isoDay(new Date(Date.now() - 30 * DAY_MS))}&toDate=${isoDay(new Date())}`;
  const json = await fetchJson(url);
  return (json.features ?? [])
    .filter((f: { geometry?: { type: string } }) => f.geometry?.type === "Point")
    .map(
      (f: {
        geometry: { coordinates: [number, number] };
        properties: {
          eventtype: string;
          eventid: number;
          episodeid: number;
          name: string;
          alertlevel?: string;
          fromdate: string;
          todate?: string;
          iscurrent?: string;
          url?: { report?: string };
          severitydata?: { severitytext?: string };
        };
      }): LiveHazard => {
        const p = f.properties;
        const [lng, lat] = f.geometry.coordinates;
        const level = p.alertlevel?.toUpperCase();
        return {
          id: `gdacs-${p.eventtype}-${p.eventid}-${p.episodeid}`,
          source: "GDACS",
          type: GDACS_TYPE[p.eventtype] ?? "OTHER",
          title: p.name,
          // GDACS reports floods as "Magnitude 0"; the alert level says more.
          detail:
            p.severitydata?.severitytext && !/magnitude 0\b/i.test(p.severitydata.severitytext)
              ? p.severitydata.severitytext
              : `${p.alertlevel ?? "Unrated"} alert · ${new Date(`${p.fromdate}Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
          alertLevel: level === "GREEN" || level === "ORANGE" || level === "RED" ? level : null,
          latitude: lat,
          longitude: lng,
          startedAt: new Date(`${p.fromdate}Z`).toISOString(),
          endedAt: p.todate ? new Date(`${p.todate}Z`).toISOString() : null,
          isCurrent: p.iscurrent === "true",
          url:
            p.url?.report ??
            `https://www.gdacs.org/report.aspx?eventtype=${p.eventtype}&eventid=${p.eventid}`,
        };
      }
    );
}

const ALERT_RANK: Record<string, number> = { RED: 3, ORANGE: 2, GREEN: 1 };

export class LiveFeedsService {
  /** Real events across India from USGS and GDACS. Each feed fails independently. */
  static async getIndiaHazards(): Promise<LiveHazardsResponse> {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

    const feeds = [
      { name: "USGS" as const, run: usgsEarthquakes },
      { name: "GDACS" as const, run: gdacsEvents },
    ];
    const settled = await Promise.allSettled(feeds.map((f) => f.run()));

    const hazards: LiveHazard[] = [];
    const sources: FeedStatus[] = settled.map((r, i) => {
      if (r.status === "fulfilled") {
        hazards.push(...r.value);
        return { name: feeds[i].name, ok: true, count: r.value.length };
      }
      console.error(`${feeds[i].name} feed failed:`, r.reason);
      return { name: feeds[i].name, ok: false, count: 0, error: String(r.reason?.message ?? r.reason) };
    });

    // Current first, then by alert level, then most recent.
    hazards.sort(
      (a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) ||
        (ALERT_RANK[b.alertLevel ?? ""] ?? 0) - (ALERT_RANK[a.alertLevel ?? ""] ?? 0) ||
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    const data: LiveHazardsResponse = { hazards, sources, fetchedAt: new Date().toISOString() };
    // Don't pin a total outage in the cache.
    if (sources.some((s) => s.ok)) cache = { at: Date.now(), data };
    return data;
  }
}
