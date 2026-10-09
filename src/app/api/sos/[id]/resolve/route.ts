import { NextResponse } from "next/server";
import { SOSService } from "@/services/sos-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { authorUserId, message } = body;

    if (!authorUserId) {
      return NextResponse.json(
        { success: false, error: "Author User ID is required" },
        { status: 400 }
      );
    }

    const updated = await SOSService.markResolved(
      id,
      authorUserId,
      message || "Evacuation / rescue confirmed complete."
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to resolve SOS" },
      { status: 400 }
    );
  }
}
