import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/")).toBe("/");
    expect(safeRedirectPath("/reports?x=1")).toBe("/reports?x=1");
  });

  it("rejects other sites and junk", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "javascript:alert(1)", "", null, undefined]) {
      expect(safeRedirectPath(bad)).toBe("/");
    }
  });
});
