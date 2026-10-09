import { NextResponse } from "next/server";
import { SOSAuthorizationError, SOSService } from "@/services/sos-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { authorUserId, message } = body;

    if (!authorUserId || !message) {
      return NextResponse.json(
        { success: false, error: "Author ID and progress message are required" },
        { status: 400 }
      );
    }

    const updated = await SOSService.addAssistanceUpdate(
      id,
      authorUserId,
      message
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to post update" },
      { status: error instanceof SOSAuthorizationError ? 403 : 400 }
    );
  }
}
