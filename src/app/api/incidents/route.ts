import { NextResponse } from "next/server";
import { IncidentService } from "@/services/incident-service";

export async function GET() {
  try {
    const incidents = await IncidentService.getIncidents();
    return NextResponse.json({ success: true, data: incidents });
  } catch (error: any) {
    console.error("GET /api/incidents failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch incidents" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      category,
      categoryLabel,
      latitude,
      longitude,
      localityName,
      description,
      reportedImpact,
      observedAt,
      reporterId,
    } = body;

    if (!category || !latitude || !longitude || !description || !reporterId) {
      return NextResponse.json(
        { success: false, error: "Missing required hazard report fields" },
        { status: 400 }
      );
    }

    const incident = await IncidentService.createIncident({
      category,
      categoryLabel: categoryLabel || category,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      localityName: localityName || "Kolkata Metropolitan Area",
      description,
      reportedImpact: reportedImpact || "Under investigation",
      observedAt: observedAt ? new Date(observedAt) : new Date(),
      reporterId,
    });

    return NextResponse.json({ success: true, data: incident }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/incidents failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create incident" },
      { status: 500 }
    );
  }
}
