import { NextResponse } from "next/server";
import { PresenceService } from "@/services/presence-service";

/** Leave the shared walk. Accepts sendBeacon payloads (text/plain JSON). */
export async function POST(request: Request) {
  try {
    const { id } = JSON.parse(await request.text());
    if (typeof id === "string") PresenceService.leave(id);
  } catch {
    /* nothing to do */
  }
  return NextResponse.json({ success: true });
}
