import { describe, it, expect } from "vitest";
import { SOSAuthorizationError, SOSService } from "@/services/sos-service";
import { GET } from "@/app/api/sos/route";

// Uses the seeded local database. Only read paths and rejected writes are
// exercised, so no SOS records are created or modified.

describe("SOS viewer role is derived server-side", () => {
  it("treats anonymous viewers as public and redacts every request", async () => {
    const results = await SOSService.getSOSRequestsForViewer(undefined);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.isExact).toBe(false);
      expect(r.contactPhone).toBe("[Redacted for Civilian Privacy]");
    }
  });

  it("treats unknown user ids as public", async () => {
    expect(await SOSService.getViewerRole("usr-does-not-exist")).toBe("PUBLIC");
  });

  it("gives a registered responder exact data", async () => {
    const results = await SOSService.getSOSRequestsForViewer("usr-responder-1");
    expect(results.every((r) => r.isExact)).toBe(true);
  });

  it("ignores a client-supplied ?role=RESPONDER on the API route", async () => {
    const res = await GET(new Request("http://localhost/api/sos?role=RESPONDER"));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    for (const r of json.data) {
      expect(r.isExact).toBe(false);
      expect(r.contactPhone).toBe("[Redacted for Civilian Privacy]");
    }
  });

  it("does not let a resident claim responder access via ?role= with their own id", async () => {
    const res = await GET(
      new Request("http://localhost/api/sos?role=ADMIN&userId=usr-non-owner")
    );
    const json = await res.json();
    expect(json.data.every((r: { isExact: boolean }) => r.isExact === false)).toBe(true);
  });
});

describe("SOS mutations require a responder", () => {
  it("rejects acknowledgement by a resident before touching the record", async () => {
    await expect(
      SOSService.acknowledgeSOS("any-id", "usr-resident-1", "test")
    ).rejects.toBeInstanceOf(SOSAuthorizationError);
  });

  it("rejects status updates from anonymous/unknown users", async () => {
    await expect(
      SOSService.addAssistanceUpdate("any-id", "usr-does-not-exist", "test")
    ).rejects.toBeInstanceOf(SOSAuthorizationError);
  });
});
