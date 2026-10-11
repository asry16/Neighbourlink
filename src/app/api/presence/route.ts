import { NextResponse } from "next/server";
import { PresenceService } from "@/services/presence-service";

/** A walker reports their latest position / heading / emote. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ok = PresenceService.upsert(body);
    if (!ok) return NextResponse.json({ success: false, error: "Invalid walker update" }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Malformed request" }, { status: 400 });
  }
}
