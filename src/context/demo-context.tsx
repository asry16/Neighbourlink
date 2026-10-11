"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { INITIAL_INCIDENTS, INITIAL_SOS_REQUESTS, type DemoIncident, type DemoSOS } from "@/lib/demo-data";
import type { BasemapType } from "@/lib/map-styles";
import { useLiveLocation, type LiveLocation, type LocationStatus } from "@/lib/use-live-location";
import type { LiveHazardsResponse } from "@/lib/live-types";

export type Role = "RESIDENT" | "RESPONDER" | "ADMIN";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  organisation?: string;
  phone?: string;
}

export const DEMO_USERS: Record<Role, DemoUser> = {
  RESIDENT: {
    id: "usr-resident-1",
    name: "Priya Banerjee",
    email: "priya.kolkata@example.org",
    role: "RESIDENT",
    phone: "+91 98301 23456",
  },
  RESPONDER: {
    id: "usr-responder-1",
    name: "Sub-Inspector A. Sen",
    email: "a.sen@kdrrt.gov.in",
    role: "RESPONDER",
    organisation: "Kolkata Disaster Rapid Response Team (KDRRT)",
    phone: "+91 98309 87654",
  },
  ADMIN: {
    id: "usr-admin-1",
    name: "Civic Command Admin",
    email: "control@neighbourlink.local",
    role: "ADMIN",
    phone: "+91 98300 00112",
  },
};

/** Every seeded account selectable in the "View as" switcher. */
export const DEMO_PROFILES: DemoUser[] = [
  DEMO_USERS.RESIDENT,
  {
    id: "usr-resident-2",
    name: "Debashis Roy",
    email: "debashis.roy@example.org",
    role: "RESIDENT",
    phone: "+91 98302 34567",
  },
  {
    id: "usr-resident-3",
    name: "Sourav Mukherjee",
    email: "sourav.m@example.org",
    role: "RESIDENT",
    phone: "+91 98303 45678",
  },
  DEMO_USERS.RESPONDER,
  DEMO_USERS.ADMIN,
];

export interface Locality {
  id: string;
  name: string;
  description: string;
  lng: number;
  lat: number;
  zoom: number;
  /** A country / state overview: too broad to place a report or SOS. */
  isOverview?: boolean;
}

export const INDIA_OVERVIEW: Locality = {
  id: "india",
  name: "India (All States)",
  description: "Live cyclone, flood and earthquake alerts nationwide",
  lng: 80.5,
  lat: 22.6,
  zoom: 4.1,
  isOverview: true,
};

export const WORLD_OVERVIEW: Locality = {
  id: "world",
  name: "World",
  description: "Major earthquakes, cyclones, floods and volcanoes worldwide",
  lng: 40,
  lat: 20,
  zoom: 1.4,
  isOverview: true,
};

export const DEMO_LOCALITIES: Locality[] = [
  INDIA_OVERVIEW,
  WORLD_OVERVIEW,
  {
    id: "all-kolkata",
    name: "Kolkata Metro (All Sectors)",
    description: "Citywide overview of all active incidents & hazards",
    lng: 88.375,
    lat: 22.56,
    zoom: 12.2,
  },
  {
    id: "central-kolkata",
    name: "Central Kolkata (Park St)",
    description: "Commercial & historic district",
    lng: 88.3527,
    lat: 22.5518,
    zoom: 14.2,
  },
  {
    id: "sector-v",
    name: "Sector V (Salt Lake)",
    description: "IT Hub & low-lying waterlogged area",
    lng: 88.4312,
    lat: 22.5735,
    zoom: 14.5,
  },
  {
    id: "howrah",
    name: "Howrah Riverfront",
    description: "Riverbank proximity, tidal alert area",
    lng: 88.3476,
    lat: 22.5851,
    zoom: 13.8,
  },
  {
    id: "alipore",
    name: "Alipore / South Canal",
    description: "Drainage basin observation sector",
    lng: 88.3315,
    lat: 22.5317,
    zoom: 14,
  },
  {
    id: "new-town",
    name: "New Town Action Area I",
    description: "High-density planned residential sector",
    lng: 88.4645,
    lat: 22.5937,
    zoom: 13.5,
  },
];

export interface MapFocusRequest {
  lat: number;
  lng: number;
  zoom?: number;
  requestedAt: number;
}

const MAP_PREFS_KEY = "neighbourlink_map_prefs";

interface MapPrefs {
  basemap: BasemapType;
  labels: boolean;
}
const DEFAULT_PREFS: MapPrefs = { basemap: "street", labels: true };
const prefListeners = new Set<() => void>();
let cachedPrefs: { raw: string | null; value: MapPrefs } = { raw: null, value: DEFAULT_PREFS };

function readPrefs(): MapPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(MAP_PREFS_KEY);
  } catch {
    /* storage unavailable */
  }
  if (raw === cachedPrefs.raw) return cachedPrefs.value;
  let value = DEFAULT_PREFS;
  try {
    const p = raw ? JSON.parse(raw) : {};
    value = {
      basemap: p.basemap === "satellite" ? "satellite" : "street",
      labels: typeof p.labels === "boolean" ? p.labels : true,
    };
  } catch {
    /* corrupt value — defaults */
  }
  cachedPrefs = { raw, value };
  return value;
}

function writePrefs(next: Partial<MapPrefs>) {
  try {
    localStorage.setItem(MAP_PREFS_KEY, JSON.stringify({ ...readPrefs(), ...next }));
  } catch {
    /* ignore */
  }
  prefListeners.forEach((l) => l());
}

function subscribePrefs(listener: () => void) {
  prefListeners.add(listener);
  return () => prefListeners.delete(listener);
}

export interface LayerFilters {
  officialHazards: boolean;
  riskEstimates: boolean;
  communityReports: boolean;
  sosAreas: boolean;
  helpCentres: boolean;
  /** Real USGS / GDACS events across India. */
  liveFeeds: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  /** Related entity, e.g. "sos:<id>" or "incident:<id>". */
  link?: string | null;
  type: string;
  read: boolean;
  createdAt: string;
}

interface DemoContextType {
  currentRole: Role;
  currentUser: DemoUser;
  setRole: (role: Role) => void;
  setCurrentUserId: (id: string) => void;
  currentLocality: Locality;
  setLocality: (locality: Locality) => void;
  layerFilters: LayerFilters;
  toggleLayer: (layer: keyof LayerFilters) => void;
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  liveLocation: LiveLocation | null;
  locationStatus: LocationStatus;
  locationError: string | null;
  startLiveLocation: () => void;
  stopLiveLocation: () => void;
  is3D: boolean;
  setIs3D: (is3D: boolean) => void;
  basemapType: BasemapType;
  setBasemapType: (type: BasemapType) => void;
  satelliteLabels: boolean;
  setSatelliteLabels: (on: boolean) => void;
  /** Point chosen on the map when live location is unavailable. Not persisted. */
  manualLocation: { lat: number; lng: number } | null;
  setManualLocation: (loc: { lat: number; lng: number } | null) => void;
  liveHazards: LiveHazardsResponse | null;
  liveHazardsError: boolean;
  refreshLiveHazards: () => Promise<void>;
  /** Ask the map to fly somewhere (e.g. "Show on map" from the feed). */
  mapFocus: MapFocusRequest | null;
  requestMapFocus: (target: { lat: number; lng: number; zoom?: number }) => void;
  notificationCount: number;
  setNotificationCount: React.Dispatch<React.SetStateAction<number>>;
  incidents: DemoIncident[];
  refreshIncidents: () => Promise<void>;
  corroborateIncident: (id: string, comment?: string) => Promise<{ success: boolean; message?: string }>;
  disputeIncident: (id: string, reason: string, comment?: string) => Promise<{ success: boolean; message?: string }>;
  markIncidentResolved: (id: string, comment?: string) => Promise<{ success: boolean; message?: string }>;
  createIncidentReport: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  sosRequests: any[];
  refreshSOS: () => Promise<void>;
  submitSOS: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  acknowledgeSOS: (sosId: string, message?: string) => Promise<{ success: boolean; message?: string }>;
  resolveSOS: (sosId: string, message?: string) => Promise<{ success: boolean; message?: string }>;
  postSOSUpdate: (sosId: string, message: string) => Promise<{ success: boolean; message?: string }>;
  notifications: NotificationItem[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

/**
 * The API returns `latitude/longitude` (already redacted server-side for
 * non-responders); the UI works with the DemoSOS shape. Normalise once here.
 */
function toDemoSOS(item: any): DemoSOS {
  return {
    ...item,
    exactLatitude: item.exactLatitude ?? item.latitude,
    exactLongitude: item.exactLongitude ?? item.longitude,
    fuzzyLatitude: item.fuzzyLatitude ?? item.latitude,
    fuzzyLongitude: item.fuzzyLongitude ?? item.longitude,
  };
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string>(DEMO_USERS.RESIDENT.id);
  const [currentLocality, setLocality] = useState<Locality>(INDIA_OVERVIEW);
  const [manualLocation, setManualLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapFocus, setMapFocus] = useState<MapFocusRequest | null>(null);

  // Map-type preferences persist per browser. Server render uses defaults.
  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, () => DEFAULT_PREFS);
  const basemapType = prefs.basemap;
  const satelliteLabels = prefs.labels;
  const setBasemapType = useCallback((t: BasemapType) => writePrefs({ basemap: t }), []);
  const setSatelliteLabels = useCallback((on: boolean) => writePrefs({ labels: on }), []);
  const requestMapFocus = useCallback(
    (t: { lat: number; lng: number; zoom?: number }) => setMapFocus({ ...t, requestedAt: Date.now() }),
    []
  );
  const [layerFilters, setLayerFilters] = useState<LayerFilters>({
    officialHazards: true,
    riskEstimates: true,
    communityReports: true,
    sosAreas: true,
    helpCentres: true,
    liveFeeds: true,
  });
  const [liveHazards, setLiveHazards] = useState<LiveHazardsResponse | null>(null);
  const [liveHazardsError, setLiveHazardsError] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const live = useLiveLocation();
  const [is3D, setIs3D] = useState(false);
  const [notificationCount, setNotificationCount] = useState(3);
  const [incidents, setIncidents] = useState<DemoIncident[]>(INITIAL_INCIDENTS);
  const [sosRequests, setSosRequests] = useState<any[]>(INITIAL_SOS_REQUESTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const currentUser = DEMO_PROFILES.find((u) => u.id === currentUserId) ?? DEMO_USERS.RESIDENT;
  const currentRole = currentUser.role;
  const setRole = useCallback((role: Role) => setCurrentUserId(DEMO_USERS[role].id), []);

  // Fetch incidents
  const refreshIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/incidents");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const formatted: DemoIncident[] = json.data.map((item: any) => ({
            id: item.id,
            trackingCode: item.trackingCode,
            category: item.category,
            categoryLabel: item.categoryLabel || item.category,
            latitude: item.latitude,
            longitude: item.longitude,
            localityName: item.localityName,
            description: item.description,
            reportedImpact: item.reportedImpact,
            status: item.status,
            observationCount: Math.max(1, item.observations?.length ?? 0),
            reporterName: item.reporter?.name || "Citizen Reporter",
            reporterId: item.reporterId,
            corroboratorIds: (item.observations ?? [])
              .filter((o: { type: string }) => o.type === "CORROBORATION")
              .map((o: { userId: string }) => o.userId),
            observedAt: item.observedAt,
            createdAt: item.createdAt,
            photoUrls: (item.evidence ?? []).map((e: { fileUrl: string }) => e.fileUrl),
          }));
          setIncidents(formatted);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch /api/incidents:", err);
    }
  }, []);

  // Fetch SOS requests
  const refreshSOS = useCallback(async () => {
    try {
      const res = await fetch(`/api/sos?userId=${encodeURIComponent(currentUser.id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSosRequests(json.data.map(toDemoSOS));
        }
      }
    } catch (err) {
      console.warn("Failed to fetch /api/sos:", err);
    }
  }, [currentUser.id]);

  // Fetch notifications
  const refreshNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setNotifications(json.data);
          const unread = json.data.filter((n: any) => !n.read).length;
          setNotificationCount(unread);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch /api/notifications:", err);
    }
  }, [currentUser.id]);

  useEffect(() => {
    refreshIncidents();
    refreshSOS();
    refreshNotifications();
  }, [refreshIncidents, refreshSOS, refreshNotifications]);

  // Live disaster feeds across India (server caches for 10 minutes).
  const refreshLiveHazards = useCallback(async () => {
    try {
      const res = await fetch("/api/live-hazards");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setLiveHazards(json.data);
      setLiveHazardsError(false);
    } catch {
      setLiveHazardsError(true);
    }
  }, []);
  useEffect(() => {
    void refreshLiveHazards();
    const id = setInterval(() => void refreshLiveHazards(), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [refreshLiveHazards]);

  const corroborateIncident = async (id: string, comment: string = "Corroborated current condition") => {
    try {
      const res = await fetch(`/api/incidents/${id}/corroborate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || "Corroboration failed" };
      }
      await refreshIncidents();
      await refreshNotifications();
      return { success: true, message: "Your independent observation has been recorded." };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const disputeIncident = async (id: string, reason: string, comment: string = "") => {
    try {
      const res = await fetch(`/api/incidents/${id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, reason, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || "Dispute submission failed" };
      }
      await refreshIncidents();
      return { success: true, message: "Dispute logged. Original report preserved for community audit." };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const markIncidentResolved = async (id: string, comment: string = "Conditions reported cleared") => {
    try {
      const res = await fetch(`/api/incidents/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || "Failed to resolve incident" };
      }
      await refreshIncidents();
      return { success: true, message: "Incident marked reported resolved." };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const createIncidentReport = async (formData: any) => {
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          reporterId: currentUser.id,
          latitude: formData.latitude || currentLocality.lat,
          longitude: formData.longitude || currentLocality.lng,
          localityName: formData.localityName || currentLocality.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to submit report" };
      }
      await refreshIncidents();
      await refreshNotifications();
      return { success: true, data: data.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const submitSOS = async (formData: any) => {
    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          requesterId: currentUser.id,
          latitude: formData.latitude || currentLocality.lat,
          longitude: formData.longitude || currentLocality.lng,
          localityName: formData.localityName || currentLocality.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to broadcast SOS" };
      }
      await refreshSOS();
      await refreshNotifications();
      return { success: true, data: data.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const acknowledgeSOS = async (sosId: string, message: string = "Rescue unit has acknowledged and is en-route.") => {
    try {
      const res = await fetch(`/api/sos/${sosId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responderUserId: currentUser.id, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || "Failed to acknowledge SOS" };
      }
      await refreshSOS();
      await refreshNotifications();
      return { success: true, message: "SOS request successfully acknowledged." };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const postSOSUpdate = async (sosId: string, message: string) => {
    try {
      const res = await fetch(`/api/sos/${sosId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorUserId: currentUser.id, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || "Failed to post update" };
      }
      await refreshSOS();
      await refreshNotifications();
      return { success: true, message: "Progress update sent to the requester." };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const resolveSOS = async (sosId: string, message: string = "Evacuation complete.") => {
    try {
      const res = await fetch(`/api/sos/${sosId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorUserId: currentUser.id, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || "Failed to resolve SOS" };
      }
      await refreshSOS();
      await refreshNotifications();
      return { success: true, message: "SOS marked resolved." };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      await refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      await refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLayer = (layer: keyof LayerFilters) => {
    setLayerFilters((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  };

  return (
    <DemoContext.Provider
      value={{
        currentRole,
        currentUser,
        setRole,
        setCurrentUserId,
        liveHazards,
        liveHazardsError,
        refreshLiveHazards,
        currentLocality,
        setLocality,
        layerFilters,
        toggleLayer,
        selectedIncidentId,
        setSelectedIncidentId,
        isDrawerOpen,
        setIsDrawerOpen,
        liveLocation: live.location,
        locationStatus: live.status,
        locationError: live.error,
        startLiveLocation: live.start,
        stopLiveLocation: live.stop,
        is3D,
        setIs3D,
        basemapType,
        setBasemapType,
        satelliteLabels,
        setSatelliteLabels,
        manualLocation,
        setManualLocation,
        mapFocus,
        requestMapFocus,
        notificationCount,
        setNotificationCount,
        incidents,
        refreshIncidents,
        corroborateIncident,
        disputeIncident,
        markIncidentResolved,
        createIncidentReport,
        sosRequests,
        refreshSOS,
        submitSOS,
        acknowledgeSOS,
        resolveSOS,
        postSOSUpdate,
        notifications,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used within a DemoProvider");
  }
  return context;
}
