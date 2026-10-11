import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "nl_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AuthSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  phone?: string | null;
  googleId?: string | null;
  isGoogleUser?: boolean;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  iat: number;
  exp: number;
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || "neighbourlink-secure-session-key-development-secret-32-chars";
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getCryptoKey(usage: "sign" | "verify"): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const secretKeyData = enc.encode(getAuthSecret());
  return crypto.subtle.importKey(
    "raw",
    secretKeyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

export async function createSessionToken(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const enc = new TextEncoder();

  const encodedHeader = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(enc.encode(JSON.stringify(fullPayload)));
  const dataToSign = enc.encode(`${encodedHeader}.${encodedPayload}`);

  const key = await getCryptoKey("sign");
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, dataToSign);
  const encodedSignature = base64UrlEncode(signatureBuffer);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const enc = new TextEncoder();
    const dataToVerify = enc.encode(`${encodedHeader}.${encodedPayload}`);
    const signatureBytes = base64UrlDecode(encodedSignature);

    const key = await getCryptoKey("verify");
    const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes as unknown as BufferSource, dataToVerify);
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload: SessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (err) {
    console.warn("Session token verification failed:", err);
    return null;
  }
}

/** Set the HTTP-only secure session cookie in Route Handlers or Server Actions */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Retrieve the current session user on the server */
export async function getSessionUser(): Promise<AuthSessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload?.userId) return null;

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        phone: true,
        googleId: true,
      },
    });

    if (!dbUser) return null;

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      avatarUrl: dbUser.avatarUrl,
      phone: dbUser.phone,
      googleId: dbUser.googleId,
      isGoogleUser: Boolean(dbUser.googleId),
    };
  } catch (err) {
    console.error("Failed to resolve session user:", err);
    return null;
  }
}

/** Build Google OAuth 2.0 authorization URL */
export function getGoogleOAuthUrl(redirectUri: string, state: string = "/"): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured in environment variables");
  }

  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  return `${rootUrl}?${params.toString()}`;
}

export interface GoogleUserProfile {
  id: string; // Google sub
  email: string;
  name: string;
  picture?: string;
  verified_email?: boolean;
}

/** Exchange authorization code for tokens and fetch user profile */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleUserProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are missing");
  }

  // 1. Exchange code for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange authorization code");
  }

  // 2. Fetch user profile from userinfo endpoint
  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userData = await userRes.json();
  if (!userRes.ok || !userData.sub) {
    throw new Error("Failed to fetch Google user profile");
  }

  return {
    id: userData.sub,
    email: userData.email,
    name: userData.name || userData.email.split("@")[0],
    picture: userData.picture,
    verified_email: userData.email_verified,
  };
}

/** Verify Google ID Token (e.g. from Google Identity Services One Tap / Button) */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserProfile> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const data = await res.json();

  if (!res.ok || data.error_description || !data.sub) {
    throw new Error(data.error_description || "Invalid Google ID token");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  // If client ID is configured, verify audience
  if (clientId && data.aud !== clientId) {
    throw new Error("Token audience mismatch (aud does not match GOOGLE_CLIENT_ID)");
  }

  return {
    id: data.sub,
    email: data.email,
    name: data.name || data.email?.split("@")[0] || "Google User",
    picture: data.picture,
    verified_email: data.email_verified === "true" || data.email_verified === true,
  };
}

/** Upsert user in database from verified Google account profile */
export async function upsertGoogleUser(profile: GoogleUserProfile): Promise<AuthSessionUser> {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId: profile.id },
        { email: profile.email.toLowerCase() },
      ],
    },
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: profile.name || existingUser.name,
        avatarUrl: profile.picture || existingUser.avatarUrl,
        googleId: profile.id,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      avatarUrl: updated.avatarUrl,
      phone: updated.phone,
      googleId: updated.googleId,
      isGoogleUser: true,
    };
  }

  // Create new RESIDENT user for first-time sign in
  const created = await prisma.user.create({
    data: {
      email: profile.email.toLowerCase(),
      name: profile.name || "Resident",
      avatarUrl: profile.picture,
      googleId: profile.id,
      role: "RESIDENT",
    },
  });

  return {
    id: created.id,
    email: created.email,
    name: created.name,
    role: created.role,
    avatarUrl: created.avatarUrl,
    phone: created.phone,
    googleId: created.googleId,
    isGoogleUser: true,
  };
}
