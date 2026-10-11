import { describe, it, expect } from "vitest";
import { avatarFeatures, avatarSVG, avatarSizePx, characterHeightPx } from "@/lib/avatar";

describe("Snap-style avatars", () => {
  it("are stable for the same seed and vary across seeds", () => {
    expect(avatarFeatures("walker-a")).toEqual(avatarFeatures("walker-a"));
    const looks = new Set(
      Array.from({ length: 30 }, (_, i) => JSON.stringify(avatarFeatures(`walker-${i}`)))
    );
    expect(looks.size).toBeGreaterThan(10);
  });

  it("renders an SVG using the outfit colour", () => {
    const svg = avatarSVG("walker-a", "#e4572e");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("#e4572e");
  });

  it("grow with zoom within limits", () => {
    expect(avatarSizePx(3)).toBe(22);
    expect(avatarSizePx(12)).toBeGreaterThan(avatarSizePx(10));
    expect(avatarSizePx(22)).toBe(76);
  });

  it("scale 3D walkers with zoom, about 90 px at walking zoom", () => {
    expect(Math.round(characterHeightPx(17.6))).toBe(90);
    expect(characterHeightPx(19)).toBeGreaterThan(characterHeightPx(17.6));
    expect(characterHeightPx(15)).toBeLessThan(characterHeightPx(17.6));
    expect(characterHeightPx(10)).toBe(36);
    expect(characterHeightPx(22)).toBe(150);
  });
});
