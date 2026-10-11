import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertGoogleUser, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Supabase exchangeCodeForSession error:", error);
        return NextResponse.redirect(
          new URL(`/?auth_error=${encodeURIComponent(error.message)}`, requestUrl.origin)
        );
      }

      if (data?.user) {
        const user = data.user;
        const email = user.email || "";
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          email.split("@")[0] ||
          "Resident";
        const picture =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null;

        // Upsert into application database
        const dbUser = await upsertGoogleUser({
          id: user.id,
          email,
          name,
          picture,
          verified_email: true,
        });

        // Create unified application session cookie
        const token = await createSessionToken({
          userId: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
          avatarUrl: dbUser.avatarUrl,
        });
        await setSessionCookie(token);
      }
    } catch (err: any) {
      console.error("Auth callback exception:", err);
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(err.message || "Failed to process login")}`, requestUrl.origin)
      );
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
