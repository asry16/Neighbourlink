import { NextResponse } from "next/server";
import { SOSService } from "@/services/sos-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Any `role` query param is ignored: the role comes from the user record.
    const userId = searchParams.get("userId");

    const sosRequests = await SOSService.getSOSRequestsForViewer(userId);
    return NextResponse.json({ success: true, data: sosRequests });
  } catch (error: any) {
    console.error("GET /api/sos failed:", error);
    const message = process.env.NODE_ENV === "production" ? "Failed to fetch SOS requests" : (error.message || "Failed to fetch SOS requests");
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
      requesterId,
      latitude,
      longitude,
      localityName,
      category,
      peopleCount,
      description,
      contactPhone,
    } = body;

    if (!requesterId || !latitude || !longitude || !description || !contactPhone) {
      return NextResponse.json(
        { success: false, error: "Missing required emergency fields" },
        { status: 400 }
      );
    }

    const sos = await SOSService.createSOS({
      requesterId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      localityName: localityName || "Kolkata Metropolitan Area",
      category: category || "TRAPPED_FLOOD",
      peopleCount: parseInt(peopleCount, 10) || 1,
      description,
      contactPhone,
    });

    return NextResponse.json({ success: true, data: sos }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/sos failed:", error);
    const message = process.env.NODE_ENV === "production" ? "Failed to broadcast SOS" : (error.message || "Failed to broadcast SOS");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
