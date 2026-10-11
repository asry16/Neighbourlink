import { NextResponse } from "next/server";
import { IncidentService } from "@/services/incident-service";

export async function GET() {
  try {
    const incidents = await IncidentService.getIncidents();
    return NextResponse.json({ success: true, data: incidents });
  } catch (error: any) {
    console.error("GET /api/incidents failed:", error);
    const message = process.env.NODE_ENV === "production" ? "Failed to fetch incidents" : (error.message || "Failed to fetch incidents");
    return NextResponse.json(
      { success: false, error: message },
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
      evidence,
    } = body;

    if (!category || !latitude || !longitude || !description || !reporterId) {
      return NextResponse.json(
        { success: false, error: "Missing required hazard report fields" },
        { status: 400 }
      );
    }

    // Only accept evidence produced by /api/evidence/upload.
    const evidenceItems = Array.isArray(evidence)
      ? evidence
          .filter(
            (e: { fileUrl?: unknown }) =>
              e &&
              typeof e.fileUrl === "string" &&
              /^\/uploads\/evid_\d+_[a-z0-9]+\.(jpg|png|webp)$/.test(e.fileUrl)
          )
          .slice(0, 4)
          .map((e: { fileUrl: string; fileName?: unknown; mimeType?: unknown; sizeBytes?: unknown }) => ({
            fileUrl: e.fileUrl as string,
            fileName: String(e.fileName ?? e.fileUrl.split("/").pop()),
            mimeType: String(e.mimeType ?? "image/jpeg"),
            sizeBytes: Number(e.sizeBytes) || 0,
          }))
      : [];

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
      evidence: evidenceItems,
    });

    return NextResponse.json({ success: true, data: incident }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/incidents failed:", error);
    const message = process.env.NODE_ENV === "production" ? "Failed to create incident" : (error.message || "Failed to create incident");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
