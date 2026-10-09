import { describe, it, expect } from "vitest";
import { SOSService } from "@/services/sos-service";

describe("SOS Server-Side Privacy Redaction", () => {
  it("should redact contact phone and return fuzzed coordinates for civilian RESIDENT role", async () => {
    const results = await SOSService.getSOSRequests("RESIDENT", "usr-non-owner");
    expect(results.length).toBeGreaterThan(0);

    const first = results[0];
    expect(first.isExact).toBe(false);
    expect(first.contactPhone).toBe("[Redacted for Civilian Privacy]");
    expect(first.requesterName).toBe("Civilian Requester");

    // Fuzzed coordinates must be rounded to 2 decimal places (~1km)
    const latStr = first.latitude.toString();
    const parts = latStr.split(".");
    if (parts.length > 1) {
      expect(parts[1].length).toBeLessThanOrEqual(2);
    }
  });

  it("should provide unredacted exact coordinates and phone number for authorized RESPONDER role", async () => {
    const results = await SOSService.getSOSRequests("RESPONDER");
    expect(results.length).toBeGreaterThan(0);

    const first = results[0];
    expect(first.isExact).toBe(true);
    expect(first.contactPhone).not.toBe("[Redacted for Civilian Privacy]");
    expect(first.contactPhone).toContain("+91");
    expect(first.requesterName).not.toBe("Civilian Requester");
  });

  it("should allow requesters to view their own unredacted SOS requests", async () => {
    // usr-resident-1 is the owner of sos-101
    const results = await SOSService.getSOSRequests("RESIDENT", "usr-resident-1");
    const ownRequest = results.find((r) => r.id === "sos-101");

    if (ownRequest) {
      expect(ownRequest.isExact).toBe(true);
      expect(ownRequest.contactPhone).toContain("+91");
    }
  });
});
