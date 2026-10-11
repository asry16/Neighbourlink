import { NextRequest, NextResponse } from "next/server";
import { upsertGoogleUser, createSessionToken, setSessionCookie } from "@/lib/auth";

/**
 * Local-development shortcut that signs in a fixed demo resident without
 * Google. Disabled in production: it would otherwise let anyone sign in as
 * any email address.
 */
export async function POST(_request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  try {
    const email = "demo.resident@example.org";
    const name = "Demo Resident";
    const picture = undefined;

    const user = await upsertGoogleUser({
      id: `google-sim-${Date.now()}`,
      email,
      name,
      picture,
      verified_email: true,
    });

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
    console.error("POST /api/auth/demo-google error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create demo session" },
      { status: 500 }
    );
  }
}
