import { NextResponse } from "next/server";
import { IncidentService } from "@/services/incident-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, comment } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const updated = await IncidentService.markResolved(
      id,
      userId,
      comment || "Conditions reported cleared"
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to mark resolved" },
      { status: 400 }
    );
  }
}
