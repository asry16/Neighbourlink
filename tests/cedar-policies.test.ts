import { describe, it, expect } from "vitest";
import { checkParsePolicySet } from "@cedar-policy/cedar-wasm/nodejs";
import { authorize, type Role } from "@/authz/cedar";
import { POLICIES } from "@/authz/policies";

const who = (id: string, role: Role) => ({ id, role });
const sos = { type: "SOSRequest" as const, id: "sos-1", requesterId: "usr-priya" };
const incident = (status = "UNVERIFIED") => ({
  type: "Incident" as const,
  id: "inc-1",
  reporterId: "usr-priya",
  status,
});

describe("Cedar policies", () => {
  it("parse cleanly", () => {
    expect(checkParsePolicySet({ staticPolicies: POLICIES }).type).toBe("success");
  });

  describe("SOS privacy", () => {
    it("shows exact locations to responders and admins", () => {
      expect(authorize(who("u-r", "RESPONDER"), "ViewExactLocation", sos).allowed).toBe(true);
      expect(authorize(who("u-a", "ADMIN"), "ViewExactLocation", sos).allowed).toBe(true);
    });

    it("hides them from other residents and guests", () => {
      expect(authorize(who("usr-debashis", "RESIDENT"), "ViewExactLocation", sos).allowed).toBe(false);
      expect(authorize(who("guest", "GUEST"), "ViewExactLocation", sos).allowed).toBe(false);
    });

    it("always shows requesters their own request", () => {
      const d = authorize(who("usr-priya", "RESIDENT"), "ViewExactLocation", sos);
      expect(d.allowed).toBe(true);
      expect(d.reasons).toContain("requester-sees-own-sos");
    });
  });

  describe("SOS response", () => {
    it("lets only responders acknowledge and post updates", () => {
      expect(authorize(who("u-r", "RESPONDER"), "AcknowledgeSOS", sos).allowed).toBe(true);
      expect(authorize(who("u-r", "RESPONDER"), "PostSOSUpdate", sos).allowed).toBe(true);
      expect(authorize(who("usr-priya", "RESIDENT"), "AcknowledgeSOS", sos).allowed).toBe(false);
    });

    it("lets responders or the requester resolve, nobody else", () => {
      expect(authorize(who("u-r", "RESPONDER"), "ResolveSOS", sos).allowed).toBe(true);
      expect(authorize(who("usr-priya", "RESIDENT"), "ResolveSOS", sos).allowed).toBe(true);
      expect(authorize(who("usr-debashis", "RESIDENT"), "ResolveSOS", sos).allowed).toBe(false);
    });
  });

  describe("Corroboration", () => {
    it("allows an independent resident", () => {
      expect(authorize(who("usr-debashis", "RESIDENT"), "CorroborateIncident", incident()).allowed).toBe(true);
    });

    it("forbids self-corroboration and names the rule", () => {
      const d = authorize(who("usr-priya", "RESIDENT"), "CorroborateIncident", incident());
      expect(d.allowed).toBe(false);
      expect(d.reasons).toEqual(["no-self-corroboration"]);
    });

    it("forbids corroborating a resolved report", () => {
      const d = authorize(who("usr-debashis", "RESIDENT"), "CorroborateIncident", incident("RESOLVED"));
      expect(d.allowed).toBe(false);
      expect(d.reasons).toEqual(["no-corroborating-resolved"]);
    });
  });

  it("lets only admins publish official hazards", () => {
    expect(authorize(who("u-a", "ADMIN"), "PublishOfficialHazard", { type: "Platform" }).allowed).toBe(true);
    expect(authorize(who("u-r", "RESPONDER"), "PublishOfficialHazard", { type: "Platform" }).allowed).toBe(false);
    expect(authorize(who("usr-priya", "RESIDENT"), "PublishOfficialHazard", { type: "Platform" }).allowed).toBe(false);
  });
});
