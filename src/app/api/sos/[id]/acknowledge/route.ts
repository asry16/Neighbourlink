import { NextResponse } from "next/server";
import { SOSAuthorizationError, SOSService } from "@/services/sos-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { responderUserId, message } = body;

    if (!responderUserId) {
      return NextResponse.json(
        { success: false, error: "Responder User ID is required" },
        { status: 400 }
      );
    }

    const updated = await SOSService.acknowledgeSOS(
      id,
      responderUserId,
      message || "Rescue unit has acknowledged and is preparing deployment."
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to acknowledge SOS" },
      { status: error instanceof SOSAuthorizationError ? 403 : 400 }
    );
  }
}
