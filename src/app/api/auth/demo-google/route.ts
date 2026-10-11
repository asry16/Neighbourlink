import { NextRequest, NextResponse } from "next/server";
import { upsertGoogleUser, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email || "roy.asmita0399@gmail.com";
    const name = body.name || "Asmita Roy";
    const picture =
      body.picture ||
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80";

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
