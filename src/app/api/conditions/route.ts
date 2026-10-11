import { NextResponse } from "next/server";
import { ConditionsService } from "@/services/conditions-service";

/** Live air quality (India NAQI) and flood risk for a point. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ success: false, error: "Valid lat and lng are required" }, { status: 400 });
  }

  try {
    const data = await ConditionsService.forPoint(Number(lat.toFixed(3)), Number(lng.toFixed(3)));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/conditions failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Conditions unavailable" },
      { status: 502 }
    );
  }
}
