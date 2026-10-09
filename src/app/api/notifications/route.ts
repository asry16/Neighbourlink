import { NextResponse } from "next/server";
import { NotificationService } from "@/services/notification-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "usr-resident-1";

    const notifications = await NotificationService.getNotificationsForUser(userId);
    return NextResponse.json({ success: true, data: notifications });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    await NotificationService.markAllAsRead(userId);
    return NextResponse.json({ success: true, message: "All marked as read" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update notifications" },
      { status: 500 }
    );
  }
}
