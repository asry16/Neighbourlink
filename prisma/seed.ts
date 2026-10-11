import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Cleaning existing data...");
  await prisma.auditEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.sOSUpdate.deleteMany();
  await prisma.sOSRequest.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.riskEstimate.deleteMany();
  await prisma.hazardUpdate.deleteMany();
  await prisma.areaSubscription.deleteMany();
  await prisma.user.deleteMany();
  await prisma.responderOrganisation.deleteMany();

  console.log("🏢 Seeding Responder Organisations...");
  const kdrrt = await prisma.responderOrganisation.create({
    data: {
      id: "org-kdrrt",
      name: "Kolkata Disaster Rapid Response Team (KDRRT)",
      code: "KDRRT-WB",
      verified: true,
      contactPhone: "033-2214-3526",
      serviceAreaName: "Kolkata Metropolitan Area",
      centerLat: 22.5726,
      centerLng: 88.3639,
      radiusKm: 25.0,
      capabilities: JSON.stringify([
        "WATER_RESCUE",
        "INFLATABLE_BOATS",
        "HIGH_WATER_EVACUATION",
        "FIRST_AID",
      ]),
    },
  });

  const fireRescue = await prisma.responderOrganisation.create({
    data: {
      id: "org-fire-wb",
      name: "West Bengal Fire & Emergency Disaster Brigade",
      code: "WB-FIRE-EMG",
      verified: true,
      contactPhone: "101",
      serviceAreaName: "Greater Kolkata & Howrah",
      centerLat: 22.565,
      centerLng: 88.35,
      radiusKm: 20.0,
      capabilities: JSON.stringify([
        "TREE_CLEARANCE",
        "ELECTRICAL_SAFETY",
        "DEWATERING_PUMPS",
        "STRUCTURAL_TRIAGE",
      ]),
    },
  });

  const redCross = await prisma.responderOrganisation.create({
    data: {
      id: "org-redcross",
      name: "Indian Red Cross Society (West Bengal Branch)",
      code: "IRCS-WB",
      verified: true,
      contactPhone: "033-2287-9000",
      serviceAreaName: "Central & South Kolkata",
      centerLat: 22.551,
      centerLng: 88.354,
      radiusKm: 15.0,
      capabilities: JSON.stringify([
        "EMERGENCY_FIRST_AID",
        "AMBULANCE_DISPATCH",
        "CLEAN_DRINKING_WATER",
        "FOOD_RATIONS",
      ]),
    },
  });

  console.log("👤 Seeding Users & Roles...");
  const resident1 = await prisma.user.create({
    data: {
      id: "usr-resident-1",
      name: "Priya Banerjee",
      email: "priya.kolkata@example.org",
      role: "RESIDENT",
      phone: "+91 00000 00101",
    },
  });

  const resident2 = await prisma.user.create({
    data: {
      id: "usr-resident-2",
      name: "Debashis Roy",
      email: "debashis.roy@example.org",
      role: "RESIDENT",
      phone: "+91 00000 00102",
    },
  });

  const resident3 = await prisma.user.create({
    data: {
      id: "usr-resident-3",
      name: "Sourav Mukherjee",
      email: "sourav.m@example.org",
      role: "RESIDENT",
      phone: "+91 00000 00103",
    },
  });

  const responder = await prisma.user.create({
    data: {
      id: "usr-responder-1",
      name: "Sub-Inspector A. Sen",
      email: "responder.demo@example.org",
      role: "RESPONDER",
      phone: "+91 00000 00104",
      responderOrgId: kdrrt.id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      id: "usr-admin-1",
      name: "Civic Command Admin",
      email: "admin.demo@example.org",
      role: "ADMIN",
      phone: "+91 00000 00105",
    },
  });

  console.log("⚠️ Seeding Official Hazard Advisories...");
  await prisma.hazardUpdate.create({
    data: {
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
      issuedAt: new Date(Date.now() - 3600000 * 2),
      expiresAt: new Date(Date.now() + 3600000 * 18),
    },
  });

  await prisma.hazardUpdate.create({
    data: {
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
      issuedAt: new Date(Date.now() - 3600000 * 8),
      expiresAt: new Date(Date.now() + 3600000 * 24),
    },
  });

  console.log("🌊 Seeding Experimental Flood-Risk Estimates...");
  await prisma.riskEstimate.create({
    data: {
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
      evaluatedAt: new Date(Date.now() - 3600000),
      isDemo: false,
    },
  });

  await prisma.riskEstimate.create({
    data: {
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
      evaluatedAt: new Date(Date.now() - 1800000),
      isDemo: false,
    },
  });

  console.log("📝 Seeding Community Incidents, Observations & Disputes...");
  // 1. Waterlogging incident with 2 observations (Priya reported, Debashis corroborated)
  const inc1 = await prisma.incident.create({
    data: {
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
      observedAt: new Date(Date.now() - 3600000 * 3),
      reporterId: resident1.id,
    },
  });

  // Observations for Inc 1
  await prisma.observation.create({
    data: {
      incidentId: inc1.id,
      userId: resident1.id,
      type: "INITIAL_REPORT",
      comment: "Water level rose 12 inches within 45 minutes of heavy rain.",
      observedAt: new Date(Date.now() - 3600000 * 3),
    },
  });

  await prisma.observation.create({
    data: {
      incidentId: inc1.id,
      userId: resident2.id,
      type: "CORROBORATION",
      comment: "Corroborated: water still knee-deep near SDF building intersection.",
      observedAt: new Date(Date.now() - 3600000 * 2),
    },
  });

  // 2. Disputed incident (Sourav reported, but conditions changed / disputed)
  const inc2 = await prisma.incident.create({
    data: {
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
      observedAt: new Date(Date.now() - 3600000 * 6),
      reporterId: resident3.id,
    },
  });

  await prisma.dispute.create({
    data: {
      incidentId: inc2.id,
      userId: resident2.id,
      reason: "Tree cleared and lane reopened",
      comment:
        "KMC forestry team cut and moved tree to the sidewalk at 15:30. Single lane is now open.",
    },
  });

  // 3. Resolved incident (Alipore)
  await prisma.incident.create({
    data: {
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
      observedAt: new Date(Date.now() - 3600000 * 12),
      reporterId: resident1.id,
    },
  });

  // 4. Landslide / Riverbank scour report
  await prisma.incident.create({
    data: {
      id: "inc-4",
      trackingCode: "INC-2026-0045",
      category: "LANDSLIDE",
      categoryLabel: "Riverbank Soil Slumping / Scour",
      latitude: 22.558,
      longitude: 88.315,
      localityName: "Shibpur Riverbank Embankment",
      description:
        "Erosion along 40m riverbank stretch after spring tide surge. Fencing collapsed.",
      reportedImpact: "Pedestrian pathway cordoned off.",
      status: "UNVERIFIED",
      observedAt: new Date(Date.now() - 3600000 * 4),
      reporterId: resident2.id,
    },
  });

  // 5. Detected earthquake demo record (NOT a prediction)
  await prisma.incident.create({
    data: {
      id: "inc-5",
      trackingCode: "INC-2026-0050",
      category: "EARTHQUAKE_OBSERVATION",
      categoryLabel: "Earthquake Observation (Demo Record)",
      latitude: 22.571,
      longitude: 88.369,
      localityName: "Central Avenue / Esplanade",
      description:
        "Mild ground tremors felt on 4th floor residential building for ~8 seconds. (Labelled demo record: platform does NOT predict tremors).",
      reportedImpact: "Residents evacuated to open street temporarily. No structural damage.",
      status: "UNVERIFIED",
      observedAt: new Date(Date.now() - 3600000 * 1),
      reporterId: resident3.id,
    },
  });

  console.log("🚨 Seeding SOS Emergency Requests & Updates...");
  // SOS 1: In progress / requested
  await prisma.sOSRequest.create({
    data: {
      id: "sos-101",
      trackingCode: "SOS-2026-0901",
      requesterId: resident1.id,
      latitude: 22.5742,
      longitude: 88.4318,
      fuzzyLatitude: 22.57,
      fuzzyLongitude: 88.43,
      localityName: "Sector V (College More Area)",
      category: "TRAPPED_FLOOD",
      peopleCount: 2,
      description:
        "Elderly citizen and caretaker stranded on ground floor flat. Water entered living room up to 1.5 ft. Power cut off.",
      contactPhone: "+91 00000 00101",
      status: "REQUESTED",
      assignedOrgId: kdrrt.id,
    },
  });

  // SOS 2: Acknowledged by responder
  const sos2 = await prisma.sOSRequest.create({
    data: {
      id: "sos-102",
      trackingCode: "SOS-2026-0855",
      requesterId: resident2.id,
      latitude: 22.5855,
      longitude: 88.348,
      fuzzyLatitude: 22.59,
      fuzzyLongitude: 88.35,
      localityName: "Howrah Riverfront",
      category: "MEDICAL",
      peopleCount: 1,
      description:
        "Oxygen concentrator battery failing due to prolonged power cut in inundated lane.",
      contactPhone: "+91 00000 00102",
      status: "ACKNOWLEDGED",
      assignedOrgId: kdrrt.id,
    },
  });

  await prisma.sOSUpdate.create({
    data: {
      sosId: sos2.id,
      authorId: responder.id,
      status: "ACKNOWLEDGED",
      message: "KDRRT Unit 4 dispatched with portable generator and battery backup. ETA ~15 mins.",
    },
  });

  console.log("🔔 Seeding Notification History...");
  await prisma.notification.createMany({
    data: [
      {
        userId: resident1.id,
        title: "Official IMD Warning: Sector V Waterlogging",
        body: "Orange alert issued for heavy rainfall coinciding with Hooghly high tide.",
        type: "HAZARD_ALERT",
        status: "SENT",
        read: false,
      },
      {
        userId: resident1.id,
        title: "Your Report was Corroborated",
        body: "Debashis Roy corroborated your Sector V waterlogging observation (INC-2026-0042).",
        type: "CORROBORATION",
        status: "SENT",
        read: true,
      },
      {
        userId: responder.id,
        title: "New Priority SOS Broadcast",
        body: "SOS-2026-0901: 2 citizens trapped in Sector V floodwaters.",
        type: "SOS_DISPATCH",
        status: "SENT",
        read: false,
      },
    ],
  });

  console.log("🛡️ Seeding Audit Events...");
  await prisma.auditEvent.createMany({
    data: [
      {
        userId: resident1.id,
        action: "INCIDENT_REPORT_CREATED",
        entityType: "Incident",
        entityId: inc1.id,
        payload: JSON.stringify({ trackingCode: "INC-2026-0042", category: "FLOOD_WATERLOGGING" }),
      },
      {
        userId: resident2.id,
        action: "INDEPENDENT_CORROBORATION",
        entityType: "Incident",
        entityId: inc1.id,
        payload: JSON.stringify({ trackingCode: "INC-2026-0042", observerCount: 2 }),
      },
      {
        userId: resident1.id,
        action: "SOS_BROADCAST_RECEIVED",
        entityType: "SOSRequest",
        entityId: "sos-101",
        payload: JSON.stringify({ trackingCode: "SOS-2026-0901", peopleCount: 2 }),
      },
      {
        userId: null,
        action: "GEO_COORDINATE_REDACTED",
        entityType: "SecurityFilter",
        entityId: "sos-101",
        payload: JSON.stringify({ reason: "Public civil privacy redaction (~1km fuzz)" }),
      },
    ],
  });

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
