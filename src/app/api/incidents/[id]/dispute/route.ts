import { NextResponse } from "next/server";
import { IncidentService } from "@/services/incident-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, reason, comment } = body;

    if (!userId || !reason) {
      return NextResponse.json(
        { success: false, error: "User ID and reason are required" },
        { status: 400 }
      );
    }

    const updated = await IncidentService.disputeIncident(
      id,
      userId,
      reason,
      comment || ""
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit dispute" },
      { status: 400 }
    );
  }
}
