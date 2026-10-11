import { describe, it, expect } from "vitest";
import { IncidentService } from "@/services/incident-service";
import { prisma } from "@/lib/prisma";

describe("Incident Corroboration Anti-Abuse", () => {
  it("should record an independent observation and prevent duplicate corroboration by the same user", async () => {
    // 1. Create a fresh incident for this test
    const incident = await IncidentService.createIncident({
      category: "FLOOD_WATERLOGGING",
      categoryLabel: "Waterlogging / Flooding",
      latitude: 22.56,
      longitude: 88.42,
      localityName: "Sector V Test Sector",
      description: "Test street water accumulation",
      reportedImpact: "Pedestrian caution",
      observedAt: new Date(),
      reporterId: "usr-resident-1",
    });

    expect(incident.status).toBe("UNVERIFIED");

    // 2. An independent user (Debashis Roy, usr-resident-2) corroborates
    const corroborated = await IncidentService.corroborateIncident(
      incident.id,
      "usr-resident-2",
      "Observed water at curb level"
    );

    expect(corroborated.status).toBe("CORROBORATED");

    // 3. The SAME user tries to corroborate a second time -> MUST throw error
    await expect(
      IncidentService.corroborateIncident(
        incident.id,
        "usr-resident-2",
        "Second attempt to corroborate"
      )
    ).rejects.toThrow("already submitted an independent observation");

    // Clean up test incident
    await prisma.incident.delete({ where: { id: incident.id } });
  });

  it("should reject corroboration by the original reporter and on resolved reports", async () => {
    const incident = await IncidentService.createIncident({
      category: "FLOOD_WATERLOGGING",
      categoryLabel: "Waterlogging / Flooding",
      latitude: 22.57,
      longitude: 88.43,
      localityName: "Salt Lake Test Sector",
      description: "Self-corroboration test",
      reportedImpact: "Pedestrian caution",
      observedAt: new Date(),
      reporterId: "usr-resident-1",
    });

    // The reporter cannot count as their own independent observer
    await expect(
      IncidentService.corroborateIncident(incident.id, "usr-resident-1", "My own report")
    ).rejects.toThrow("cannot corroborate your own report");

    // Resolved reports can no longer be corroborated back to active
    await IncidentService.markResolved(incident.id, "usr-responder-1", "Cleared");
    await expect(
      IncidentService.corroborateIncident(incident.id, "usr-resident-2", "Late observation")
    ).rejects.toThrow("already been resolved");

    await prisma.incident.delete({ where: { id: incident.id } });
  });

  it("should not delete the incident when a dispute is filed", async () => {
    const incident = await IncidentService.createIncident({
      category: "STORM_DAMAGE",
      categoryLabel: "Storm Damage",
      latitude: 22.55,
      longitude: 88.35,
      localityName: "Park Street Test Sector",
      description: "Tree branch in road",
      reportedImpact: "Lane blocked",
      observedAt: new Date(),
      reporterId: "usr-resident-1",
    });

    // File dispute
    const disputed = await IncidentService.disputeIncident(
      incident.id,
      "usr-resident-3",
      "Branch was small and already moved",
      "Lane is completely clear now"
    );

    expect(disputed.status).toBe("DISPUTED");

    // Verify incident still exists in database
    const fetched = await IncidentService.getIncidentById(incident.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.disputes.length).toBe(1);

    // Clean up
    await prisma.incident.delete({ where: { id: incident.id } });
  });
});
