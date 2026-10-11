import { describe, it, expect, beforeEach } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  getGoogleOAuthUrl,
  upsertGoogleUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("Authentication & Session Service", () => {
  it("should create and verify a valid session token", async () => {
    const payload = {
      userId: "test-user-123",
      email: "test@example.com",
      name: "Test Citizen",
      role: "RESIDENT",
      avatarUrl: "https://example.com/avatar.jpg",
    };

    const token = await createSessionToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(payload.userId);
    expect(verified?.email).toBe(payload.email);
    expect(verified?.name).toBe(payload.name);
    expect(verified?.role).toBe(payload.role);
    expect(verified?.avatarUrl).toBe(payload.avatarUrl);
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("should reject a tampered session token", async () => {
    const token = await createSessionToken({
      userId: "test-user-123",
      email: "test@example.com",
      name: "Test Citizen",
      role: "RESIDENT",
    });

    const [header, payload, signature] = token.split(".");
    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ userId: "hacked", role: "ADMIN", exp: 9999999999 })
    ).toString("base64url");

    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
    const verified = await verifySessionToken(tamperedToken);
    expect(verified).toBeNull();
  });

  it("should generate a well-formed Google OAuth URL", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id-12345.apps.googleusercontent.com";
    const redirectUri = "http://localhost:3000/api/auth/callback/google";
    const urlString = getGoogleOAuthUrl(redirectUri, "/dashboard");

    const url = new URL(urlString);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client-id-12345.apps.googleusercontent.com");
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toContain("openid");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("scope")).toContain("profile");
    expect(url.searchParams.get("state")).toBe("/dashboard");
  });

  it("should upsert a Google user into the database", async () => {
    const testEmail = `test.google.${Date.now()}@example.org`;
    const googleSub = `sub-google-${Date.now()}`;

    const created = await upsertGoogleUser({
      id: googleSub,
      email: testEmail,
      name: "Google Resident",
      picture: "https://example.com/pic.png",
      verified_email: true,
    });

    expect(created.id).toBeDefined();
    expect(created.email).toBe(testEmail);
    expect(created.role).toBe("RESIDENT");
    expect(created.googleId).toBe(googleSub);
    expect(created.isGoogleUser).toBe(true);

    // Updating existing user
    const updated = await upsertGoogleUser({
      id: googleSub,
      email: testEmail,
      name: "Updated Resident Name",
      picture: "https://example.com/new-pic.png",
      verified_email: true,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Updated Resident Name");
    expect(updated.avatarUrl).toBe("https://example.com/new-pic.png");

    // Clean up
    await prisma.user.delete({ where: { id: created.id } }).catch(() => {});
  });
});
