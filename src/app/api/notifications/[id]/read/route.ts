import { NextResponse } from "next/server";
import { NotificationService } from "@/services/notification-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await NotificationService.markAsRead(id);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to mark notification read" },
      { status: 500 }
    );
  }
}
