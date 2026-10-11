export interface DemoHazardUpdate {
  id: string;
  source: string;
  sourceUrl?: string;
  isDemo: boolean;
  hazardType: string;
  severity: "ADVISORY" | "WARNING" | "CRITICAL";
  headline: string;
  description: string;
  affectedArea: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  issuedAt: string;
  expiresAt: string;
}

export interface DemoRiskEstimate {
  id: string;
  modelName: string;
  localityName: string;
  centerLat: number;
  centerLng: number;
  riskLevel: "LOW" | "ELEVATED" | "HIGH" | "INSUFFICIENT_DATA";
  rainfallRecentMm: number | null;
  rainfallForecastMm: number | null;
  waterLevelMeters: number | null;
  historicalSusceptibility: boolean;
  horizonHours: number;
  explanation: string;
  evaluatedAt: string;
  isDemo: boolean;
}

export interface DemoIncident {
  id: string;
  trackingCode: string;
  category:
    | "FLOOD_WATERLOGGING"
    | "LANDSLIDE"
    | "STORM_DAMAGE"
    | "EARTHQUAKE_OBSERVATION"
    | "OTHER_HAZARD";
  categoryLabel: string;
  latitude: number;
  longitude: number;
  localityName: string;
  description: string;
  reportedImpact: string;
  status: "UNVERIFIED" | "CORROBORATED" | "DISPUTED" | "RESOLVED";
  observationCount: number;
  reporterName: string;
  /** Present when loaded from the API. */
  reporterId?: string;
  /** Users who submitted an independent corroboration (from the API). */
  corroboratorIds?: string[];
  observedAt: string;
  createdAt: string;
  photoUrl?: string;
  photoUrls?: string[];
}

export interface DemoSOS {
  id: string;
  trackingCode: string;
  fuzzyLatitude: number;
  fuzzyLongitude: number;
  exactLatitude: number;
  exactLongitude: number;
  localityName: string;
  category: "TRAPPED_FLOOD" | "MEDICAL" | "EVACUATION" | "SUPPLIES";
  peopleCount: number;
  description: string;
  contactPhone: string;
  status: "REQUESTED" | "ACKNOWLEDGED" | "ASSISTANCE_REPORTED" | "RESOLVED";
  assignedOrgName?: string;
  requesterName: string;
  createdAt: string;
}

export interface DemoHelpCentre {
  id: string;
  name: string;
  type: "SHELTER" | "MEDICAL_AID" | "COMMUNITY_KITCHEN";
  latitude: number;
  longitude: number;
  localityName: string;
  capacityTotal: number;
  capacityAvailable: number;
  contactPhone: string;
  facilities: string[];
}

export const INITIAL_OFFICIAL_HAZARDS: DemoHazardUpdate[] = [
  {
    id: "off-haz-1",
    source: "Regional Meteorological Centre, Kolkata (IMD)",
    sourceUrl: "https://mausam.imd.gov.in/kolkata/",
    isDemo: false,
    hazardType: "FLOOD_WATERLOGGING",
    severity: "WARNING",
    headline: "Orange Alert: Heavy Downpour & High Tide Surge Advisory",
    description:
      "Intense convection band active over Gangetic West Bengal. High risk of persistent street waterlogging across low-lying wards with canal lock-gate closures during Hooghly high tide (19:40 IST).",
    affectedArea: "KMC Wards 58, 66, 107 (EM Bypass & Salt Lake corridor)",
    centerLat: 22.565,
    centerLng: 88.41,
    radiusKm: 4.5,
    issuedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    expiresAt: new Date(Date.now() + 3600000 * 18).toISOString(),
  },
  {
    id: "off-haz-2",
    source: "Geological Survey of India (GSI)",
    isDemo: false,
    hazardType: "LANDSLIDE",
    severity: "ADVISORY",
    headline: "Riverbank Soil Slumping & Erosion Watch",
    description:
      "Tidal wave scour identified along unpaved riverbank embankment near Botanical Garden stretch. Heavy vehicles advised to divert.",
    affectedArea: "Shibpur / Botanical Garden Riverbank",
    centerLat: 22.555,
    centerLng: 88.31,
    radiusKm: 2.0,
    issuedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    expiresAt: new Date(Date.now() + 3600000 * 24).toISOString(),
  },
];

export const INITIAL_RISK_ESTIMATES: DemoRiskEstimate[] = [
  {
    id: "risk-sec-v",
    modelName: "Experimental Rule-Based Flood Engine v1.0",
    localityName: "Sector V / Salt Lake IT District",
    centerLat: 22.5735,
    centerLng: 88.4312,
    riskLevel: "ELEVATED",
    rainfallRecentMm: 62.4,
    rainfallForecastMm: 28.0,
    waterLevelMeters: 1.45,
    historicalSusceptibility: true,
    horizonHours: 24,
    explanation:
      "Cumulative rainfall past 24h exceeds 50mm threshold (62.4mm observed). Combined with historical low elevation and drainage basin saturation, heuristic indicates elevated waterlogging risk.",
    evaluatedAt: new Date(Date.now() - 3600000).toISOString(),
    isDemo: false,
  },
  {
    id: "risk-howrah",
    modelName: "Experimental Rule-Based Flood Engine v1.0",
    localityName: "Howrah Riverfront",
    centerLat: 22.5851,
    centerLng: 88.3476,
    riskLevel: "HIGH",
    rainfallRecentMm: 74.0,
    rainfallForecastMm: 35.5,
    waterLevelMeters: 2.1,
    historicalSusceptibility: true,
    horizonHours: 24,
    explanation:
      "Severe convergence: heavy rainfall forecast coinciding with Hooghly River spring tide peak. River sluice backflow risk elevated.",
    evaluatedAt: new Date(Date.now() - 1800000).toISOString(),
    isDemo: false,
  },
];

export const INITIAL_INCIDENTS: DemoIncident[] = [
  {
    id: "inc-1",
    trackingCode: "INC-2026-0042",
    category: "FLOOD_WATERLOGGING",
    categoryLabel: "Waterlogging / Flooding",
    latitude: 22.5765,
    longitude: 88.4345,
    localityName: "Sector V (Near Webel More)",
    description:
      "Knee-deep water accumulation on main arterial road. Vehicles stalling, two-wheelers unable to pass.",
    reportedImpact: "Major traffic diversion, basement power sub-station threatened.",
    status: "CORROBORATED",
    observationCount: 3,
    reporterName: "Priya Banerjee",
    observedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: "inc-2",
    trackingCode: "INC-2026-0038",
    category: "STORM_DAMAGE",
    categoryLabel: "Storm Damage / Fallen Tree",
    latitude: 22.553,
    longitude: 88.356,
    localityName: "Park Street (Near Middleton Row)",
    description:
      "Large gulmohar tree uprooted across north-bound lane. Power cables snapped, caution live wire risk.",
    reportedImpact: "Road completely blocked; power shut down for safety.",
    status: "DISPUTED",
    observationCount: 2,
    reporterName: "Sourav M.",
    observedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: "inc-3",
    trackingCode: "INC-2026-0029",
    category: "FLOOD_WATERLOGGING",
    categoryLabel: "Waterlogging / Flooding",
    latitude: 22.529,
    longitude: 88.334,
    localityName: "Alipore / Chetla Canal Road",
    description:
      "Canal overflowed during heavy cloudburst. Water receded after pumping station activated.",
    reportedImpact: "Previous street immersion; now cleared.",
    status: "RESOLVED",
    observationCount: 4,
    reporterName: "Rohan D.",
    observedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: "inc-4",
    trackingCode: "INC-2026-0050",
    category: "EARTHQUAKE_OBSERVATION",
    categoryLabel: "Earthquake Observation (Demo Record)",
    latitude: 22.571,
    longitude: 88.369,
    localityName: "Central Avenue / Esplanade",
    description:
      "Mild ground tremors felt on 4th floor residential building for ~8 seconds. Ceiling fan oscillated. (Labelled demo record: platform does NOT predict tremors).",
    reportedImpact: "Residents evacuated to open street temporarily. No structural cracks observed.",
    status: "UNVERIFIED",
    observationCount: 1,
    reporterName: "Ananya Ghosh",
    observedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
];

export const INITIAL_SOS_REQUESTS: DemoSOS[] = [
  {
    id: "sos-101",
    trackingCode: "SOS-2026-0901",
    fuzzyLatitude: 22.574,
    fuzzyLongitude: 88.432,
    exactLatitude: 22.5742,
    exactLongitude: 88.4318,
    localityName: "Sector V (College More Area)",
    category: "TRAPPED_FLOOD",
    peopleCount: 2,
    description:
      "Elderly citizen and caretaker stranded on ground floor flat. Water entered living room up to 1.5 ft. Power cut off.",
    contactPhone: "+91 00000 00106",
    status: "REQUESTED",
    requesterName: "Dr. B. K. Mukherjee",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

export const INITIAL_HELP_CENTRES: DemoHelpCentre[] = [
  {
    id: "hc-1",
    name: "Salt Lake Municipal Relief Shelter & First Aid",
    type: "SHELTER",
    latitude: 22.581,
    longitude: 88.421,
    localityName: "Salt Lake Block CF",
    capacityTotal: 150,
    capacityAvailable: 92,
    contactPhone: "033-2334-1234",
    facilities: ["Clean Water", "Medical Station", "Emergency Power", "Dry Rations"],
  },
  {
    id: "hc-2",
    name: "Park Street Red Cross Community Station",
    type: "MEDICAL_AID",
    latitude: 22.551,
    longitude: 88.354,
    localityName: "Park Street / Camac St Corner",
    capacityTotal: 60,
    capacityAvailable: 34,
    contactPhone: "033-2287-9000",
    facilities: ["First Aid Triage", "Ambulance Bay", "Drinking Water Supply"],
  },
];
