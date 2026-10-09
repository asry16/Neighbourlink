import { prisma } from "@/lib/prisma";

export interface CreateSOSInput {
  requesterId: string;
  latitude: number;
  longitude: number;
  localityName: string;
  category: "TRAPPED_FLOOD" | "MEDICAL" | "EVACUATION" | "SUPPLIES";
  peopleCount: number;
  description: string;
  contactPhone: string;
}

export class SOSService {
  /**
   * Helper to round coordinates to ~1km precision for civilian privacy
   */
  private static roundToFuzzy(coord: number): number {
    return Math.round(coord * 100) / 100;
  }

  /**
   * Helper to compute approximate Haversine distance in km
   */
  private static calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Create an SOS Emergency Request
   * Routes to nearest registered participating responder organisation
   */
  static async createSOS(input: CreateSOSInput) {
    const count = await prisma.sOSRequest.count();
    const trackingCode = `SOS-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    // Fuzz coordinates (~1km grid box)
    const fuzzyLatitude = this.roundToFuzzy(input.latitude);
    const fuzzyLongitude = this.roundToFuzzy(input.longitude);

    // Match participating responder organisation by verified participation and proximity
    const orgs = await prisma.responderOrganisation.findMany({
      where: { verified: true },
    });

    let assignedOrgId: string | null = null;
    let minDistance = Infinity;

    for (const org of orgs) {
      const dist = this.calculateDistanceKm(
        input.latitude,
        input.longitude,
        org.centerLat,
        org.centerLng
      );
      if (dist <= org.radiusKm && dist < minDistance) {
        minDistance = dist;
        assignedOrgId = org.id;
      }
    }

    // Default to first organisation if outside exact radius for demo safety
    if (!assignedOrgId && orgs.length > 0) {
      assignedOrgId = orgs[0].id;
    }

    const sos = await prisma.sOSRequest.create({
      data: {
        trackingCode,
        requesterId: input.requesterId,
        latitude: input.latitude,
        longitude: input.longitude,
        fuzzyLatitude,
        fuzzyLongitude,
        localityName: input.localityName,
        category: input.category,
        peopleCount: input.peopleCount,
        description: input.description,
        contactPhone: input.contactPhone,
        status: "REQUESTED",
        assignedOrgId,
      },
      include: {
        assignedOrg: true,
        requester: { select: { id: true, name: true } },
      },
    });

    // Notify responder organisation members
    if (assignedOrgId) {
      const responders = await prisma.user.findMany({
        where: { responderOrgId: assignedOrgId },
      });
      for (const responder of responders) {
        await prisma.notification.create({
          data: {
            userId: responder.id,
            title: `Priority SOS Alert: ${input.category}`,
            body: `${input.peopleCount} citizen(s) stranded in ${input.localityName}. Tracking: ${trackingCode}`,
            type: "SOS_DISPATCH",
            status: "SENT",
          },
        });
      }
    }

    // Notify requester with acknowledgment confirmation
    await prisma.notification.create({
      data: {
        userId: input.requesterId,
        title: "SOS Broadcast Dispatched",
        body: `Your request (${trackingCode}) has been routed to registered participating disaster response units. Keep line open.`,
        type: "SOS_UPDATE",
        status: "SENT",
      },
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        userId: input.requesterId,
        action: "SOS_REQUESTED",
        entityType: "SOSRequest",
        entityId: sos.id,
        payload: JSON.stringify({
          trackingCode,
          category: input.category,
          peopleCount: input.peopleCount,
          assignedOrgId,
        }),
      },
    });

    return sos;
  }

  /**
   * Fetch SOS requests with strict server-side redaction for civilian security
   */
  static async getSOSRequests(role: string, currentUserId?: string) {
    const isAuthorized = role === "RESPONDER" || role === "ADMIN";

    const requests = await prisma.sOSRequest.findMany({
      include: {
        requester: { select: { id: true, name: true } },
        assignedOrg: { select: { id: true, name: true, contactPhone: true } },
        updates: {
          include: { author: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests.map((sos) => {
      const isOwner = currentUserId && sos.requesterId === currentUserId;

      if (isAuthorized || isOwner) {
        // Full unredacted data for responders or the requester themselves
        return {
          id: sos.id,
          trackingCode: sos.trackingCode,
          category: sos.category,
          peopleCount: sos.peopleCount,
          description: sos.description,
          contactPhone: sos.contactPhone,
          localityName: sos.localityName,
          status: sos.status,
          latitude: sos.latitude,
          longitude: sos.longitude,
          fuzzyLatitude: sos.fuzzyLatitude,
          fuzzyLongitude: sos.fuzzyLongitude,
          isExact: true,
          requesterName: sos.requester.name,
          assignedOrgName: sos.assignedOrg?.name,
          createdAt: sos.createdAt,
          updates: sos.updates,
        };
      }

      // Public redacted representation:
      // Exact coordinates stripped, phone number redacted, detailed address notes generalized
      return {
        id: sos.id,
        trackingCode: sos.trackingCode,
        category: sos.category,
        peopleCount: sos.peopleCount,
        description: "Emergency assistance requested. Sector approximate location displayed.",
        contactPhone: "[Redacted for Civilian Privacy]",
        localityName: sos.localityName,
        status: sos.status,
        latitude: sos.fuzzyLatitude, // Fuzzed coordinates returned as primary coordinates
        longitude: sos.fuzzyLongitude,
        fuzzyLatitude: sos.fuzzyLatitude,
        fuzzyLongitude: sos.fuzzyLongitude,
        isExact: false,
        requesterName: "Civilian Requester",
        assignedOrgName: sos.assignedOrg?.name,
        createdAt: sos.createdAt,
        updates: sos.updates.map((u) => ({
          id: u.id,
          status: u.status,
          message: u.message,
          createdAt: u.createdAt,
        })),
      };
    });
  }

  /**
   * Responder acknowledges an SOS request
   */
  static async acknowledgeSOS(
    sosId: string,
    responderUserId: string,
    message: string = "Rescue unit has acknowledged and is preparing deployment."
  ) {
    const sos = await prisma.sOSRequest.findUnique({
      where: { id: sosId },
      include: { assignedOrg: true },
    });

    if (!sos) throw new Error("SOS Request not found");

    const updated = await prisma.sOSRequest.update({
      where: { id: sosId },
      data: { status: "ACKNOWLEDGED" },
      include: { assignedOrg: true },
    });

    // Create SOS Update
    await prisma.sOSUpdate.create({
      data: {
        sosId,
        authorId: responderUserId,
        status: "ACKNOWLEDGED",
        message,
      },
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        userId: sos.requesterId,
        title: "Responder Acknowledged Your SOS",
        body: `${updated.assignedOrg?.name || "Disaster unit"} has acknowledged your request (${sos.trackingCode}). ${message}`,
        type: "SOS_UPDATE",
        status: "SENT",
      },
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        userId: responderUserId,
        action: "SOS_ACKNOWLEDGED",
        entityType: "SOSRequest",
        entityId: sosId,
        payload: JSON.stringify({ trackingCode: sos.trackingCode, message }),
      },
    });

    return updated;
  }

  /**
   * Responder posts an assistance progress update
   */
  static async addAssistanceUpdate(
    sosId: string,
    authorUserId: string,
    message: string
  ) {
    const sos = await prisma.sOSRequest.findUnique({ where: { id: sosId } });
    if (!sos) throw new Error("SOS Request not found");

    const updated = await prisma.sOSRequest.update({
      where: { id: sosId },
      data: { status: "ASSISTANCE_REPORTED" },
    });

    await prisma.sOSUpdate.create({
      data: {
        sosId,
        authorId: authorUserId,
        status: "ASSISTANCE_REPORTED",
        message,
      },
    });

    await prisma.notification.create({
      data: {
        userId: sos.requesterId,
        title: "Rescue Update on Your SOS",
        body: message,
        type: "SOS_UPDATE",
        status: "SENT",
      },
    });

    return updated;
  }

  /**
   * Mark SOS resolved
   */
  static async markResolved(sosId: string, authorUserId: string, message: string = "Evacuation / rescue confirmed complete.") {
    const sos = await prisma.sOSRequest.findUnique({ where: { id: sosId } });
    if (!sos) throw new Error("SOS Request not found");

    const updated = await prisma.sOSRequest.update({
      where: { id: sosId },
      data: { status: "RESOLVED" },
    });

    await prisma.sOSUpdate.create({
      data: {
        sosId,
        authorId: authorUserId,
        status: "RESOLVED",
        message,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: authorUserId,
        action: "SOS_RESOLVED",
        entityType: "SOSRequest",
        entityId: sosId,
        payload: JSON.stringify({ trackingCode: sos.trackingCode }),
      },
    });

    return updated;
  }
}
