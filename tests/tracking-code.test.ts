import { describe, it, expect } from "vitest";
import { nextTrackingCode } from "@/lib/tracking-code";

describe("nextTrackingCode", () => {
  it("starts at 0001", () => {
    expect(nextTrackingCode("INC", 2026, [])).toBe("INC-2026-0001");
  });

  it("follows the highest existing number, not the count", () => {
    // Seed data has a high number with few rows: a count would collide.
    expect(nextTrackingCode("INC", 2026, ["INC-2026-0050", "INC-2026-0002"])).toBe("INC-2026-0051");
    expect(nextTrackingCode("SOS", 2026, ["SOS-2026-0901", "SOS-2026-0855"])).toBe("SOS-2026-0902");
  });

  it("ignores other years, prefixes and malformed codes", () => {
    expect(nextTrackingCode("INC", 2027, ["INC-2026-0099", "SOS-2027-0005", "INC-2027-abc"])).toBe("INC-2027-0001");
  });

  it("grows past four digits", () => {
    expect(nextTrackingCode("INC", 2026, ["INC-2026-9999"])).toBe("INC-2026-10000");
  });
});
