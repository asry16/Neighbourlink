import { NextRequest, NextResponse } from "next/server";
import { verifyGoogleIdToken, upsertGoogleUser, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credential } = body;

    if (!credential || typeof credential !== "string") {
      return NextResponse.json({ success: false, error: "Missing credential ID token" }, { status: 400 });
    }

    const profile = await verifyGoogleIdToken(credential);
    const user = await upsertGoogleUser(profile);

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isGoogleUser: true,
      },
    });
  } catch (error: any) {
    console.error("POST /api/auth/google/verify error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to verify Google credential" },
      { status: 401 }
    );
  }
}
