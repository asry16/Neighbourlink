import { connection, NextResponse } from "next/server";
import { LiveFeedsService } from "@/services/live-feeds-service";

export async function GET() {
  // Live data: never prerender this at build time.
  await connection();
  try {
    const data = await LiveFeedsService.getHazards();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/live-hazards failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Live feeds unavailable" },
      { status: 502 }
    );
  }
}
