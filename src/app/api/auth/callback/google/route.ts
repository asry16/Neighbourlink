import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, upsertGoogleUser, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "/";
  const error = searchParams.get("error");

  if (error) {
    console.error("Google OAuth error callback:", error);
    return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error)}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", origin));
  }

  try {
    const redirectUri = `${origin}/api/auth/callback/google`;
    const googleProfile = await exchangeGoogleCode(code, redirectUri);
    const user = await upsertGoogleUser(googleProfile);

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });

    await setSessionCookie(token);

    const targetUrl = state.startsWith("/") ? state : "/";
    return NextResponse.redirect(new URL(`${targetUrl}?auth_success=1`, origin));
  } catch (err: any) {
    console.error("Google OAuth callback exchange failed:", err);
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(err.message || "Failed to authenticate with Google")}`, origin)
    );
  }
}
