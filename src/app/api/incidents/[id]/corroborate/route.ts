import { NextResponse } from "next/server";
import { IncidentService } from "@/services/incident-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, comment, observedAt } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required to record observation" },
        { status: 400 }
      );
    }

    const updated = await IncidentService.corroborateIncident(
      id,
      userId,
      comment || "Corroborated current condition",
      observedAt ? new Date(observedAt) : new Date()
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes("already") ? 409 : 400;
    return NextResponse.json(
      { success: false, error: error.message || "Failed to corroborate incident" },
      { status }
    );
  }
}
