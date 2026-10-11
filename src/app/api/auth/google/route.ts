import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthUrl } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get("state") || "/";

  // Build callback URL
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/callback/google`;

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.redirect(
      new URL(`/?auth_error=missing_google_client_id&origin=${encodeURIComponent(state)}`, origin)
    );
  }

  try {
    const authUrl = getGoogleOAuthUrl(redirectUri, state);
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("GET /api/auth/google error:", error);
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error.message || "Failed to start Google sign in")}`, origin)
    );
  }
}
