import { prisma } from "@/lib/prisma";

export interface CreateIncidentInput {
  category: string;
  categoryLabel: string;
  latitude: number;
  longitude: number;
  localityName: string;
  description: string;
  reportedImpact: string;
  observedAt: Date;
  reporterId: string;
  photoUrl?: string;
}

export class IncidentService {
  /**
   * Fetch all incidents with observation counts and reporter details
   */
  static async getIncidents() {
    return prisma.incident.findMany({
      include: {
        reporter: {
          select: { id: true, name: true, role: true },
        },
        observations: {
          include: {
            user: { select: { id: true, name: true, role: true } },
            evidence: true,
          },
          orderBy: { observedAt: "desc" },
        },
        disputes: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        evidence: true,
      },
      orderBy: { observedAt: "desc" },
    });
  }

  /**
   * Fetch single incident with full observation and dispute trails
   */
  static async getIncidentById(id: string) {
    return prisma.incident.findUnique({
      where: { id },
      include: {
        reporter: {
          select: { id: true, name: true, role: true },
        },
        observations: {
          include: {
            user: { select: { id: true, name: true, role: true } },
            evidence: true,
          },
          orderBy: { observedAt: "desc" },
        },
        disputes: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        evidence: true,
      },
    });
  }

  /**
   * Create new hazard report with initial observation
   */
  static async createIncident(input: CreateIncidentInput) {
    // Generate tracking code
    const count = await prisma.incident.count();
    const trackingCode = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const incident = await prisma.incident.create({
      data: {
        trackingCode,
        category: input.category,
        categoryLabel: input.categoryLabel,
        latitude: input.latitude,
        longitude: input.longitude,
        localityName: input.localityName,
        description: input.description,
        reportedImpact: input.reportedImpact,
        status: "UNVERIFIED",
        observedAt: input.observedAt,
        reporterId: input.reporterId,
        observations: {
          create: {
            userId: input.reporterId,
            type: "INITIAL_REPORT",
            comment: input.description,
            observedAt: input.observedAt,
          },
        },
      },
      include: {
        reporter: true,
        observations: true,
      },
    });

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        userId: input.reporterId,
        action: "INCIDENT_CREATED",
        entityType: "Incident",
        entityId: incident.id,
        payload: JSON.stringify({ trackingCode, category: input.category }),
      },
    });

    return incident;
  }

  /**
   * Corroborate an existing incident (records an independent observation)
   * Prevents duplicate corroborations by the same user!
   */
  static async corroborateIncident(
    incidentId: string,
    userId: string,
    comment: string,
    observedAt: Date = new Date()
  ) {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: { observations: true },
    });

    if (!incident) {
      throw new Error("Incident not found");
    }

    // Check if this user has already corroborated this incident
    const alreadyObserved = incident.observations.some(
      (obs) => obs.userId === userId && obs.type === "CORROBORATION"
    );

    if (alreadyObserved) {
      throw new Error("You have already submitted an independent observation for this incident.");
    }

    // Add observation
    const observation = await prisma.observation.create({
      data: {
        incidentId,
        userId,
        type: "CORROBORATION",
        comment: comment || "Corroborated current condition at this location.",
        observedAt,
      },
    });

    // Update incident status to CORROBORATED
    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: "CORROBORATED",
      },
      include: {
        observations: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        userId,
        action: "INDEPENDENT_CORROBORATION",
        entityType: "Incident",
        entityId: incidentId,
        payload: JSON.stringify({
          trackingCode: incident.trackingCode,
          observationId: observation.id,
        }),
      },
    });

    return updatedIncident;
  }

  /**
   * Submit dispute for an incident (does not erase the incident!)
   */
  static async disputeIncident(
    incidentId: string,
    userId: string,
    reason: string,
    comment: string
  ) {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) throw new Error("Incident not found");

    await prisma.dispute.create({
      data: {
        incidentId,
        userId,
        reason,
        comment,
      },
    });

    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: { status: "DISPUTED" },
    });

    await prisma.auditEvent.create({
      data: {
        userId,
        action: "INCIDENT_DISPUTED",
        entityType: "Incident",
        entityId: incidentId,
        payload: JSON.stringify({ reason, comment }),
      },
    });

    return updatedIncident;
  }

  /**
   * Mark conditions resolved / cleared
   */
  static async markResolved(incidentId: string, userId: string, comment: string) {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) throw new Error("Incident not found");

    await prisma.observation.create({
      data: {
        incidentId,
        userId,
        type: "RESOLVED_REPORT",
        comment: comment || "Conditions reported cleared/safe.",
        observedAt: new Date(),
      },
    });

    const updated = await prisma.incident.update({
      where: { id: incidentId },
      data: { status: "RESOLVED" },
    });

    await prisma.auditEvent.create({
      data: {
        userId,
        action: "INCIDENT_RESOLVED",
        entityType: "Incident",
        entityId: incidentId,
        payload: JSON.stringify({ comment }),
      },
    });

    return updated;
  }
}
