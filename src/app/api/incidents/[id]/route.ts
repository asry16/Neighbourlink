import { NextResponse } from "next/server";
import { IncidentService } from "@/services/incident-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const incident = await IncidentService.getIncidentById(id);

    if (!incident) {
      return NextResponse.json(
        { success: false, error: "Incident not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: incident });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch incident" },
      { status: 500 }
    );
  }
}
