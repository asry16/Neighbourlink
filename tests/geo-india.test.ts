import { describe, it, expect } from "vitest";
import { isInIndia } from "@/lib/geo-india";

describe("isInIndia (coarse outline)", () => {
  it.each([
    ["Delhi", 28.61, 77.21],
    ["Mumbai", 19.08, 72.88],
    ["Kolkata", 22.57, 88.36],
    ["Chennai", 13.08, 80.27],
    ["Kanyakumari", 8.2, 77.53],
    ["Guwahati", 26.14, 91.74],
    ["Shillong", 25.58, 91.89],
    ["Siliguri", 26.73, 88.4],
    ["Srinagar", 34.08, 74.8],
    ["Port Blair", 11.62, 92.73],
    ["Kavaratti", 10.57, 72.64],
    ["Bhuj", 23.25, 69.67],
  ])("includes %s", (_name, lat, lng) => {
    expect(isInIndia(lat, lng)).toBe(true);
  });

  it.each([
    ["Lahore", 31.55, 74.34],
    ["Karachi", 24.86, 67.0],
    ["Kathmandu", 27.72, 85.32],
    ["Dhaka", 23.81, 90.41],
    ["Thimphu", 27.47, 89.64],
    ["Colombo", 6.93, 79.86],
    ["Yangon", 16.84, 96.17],
    ["London", 51.5, -0.12],
  ])("excludes %s", (_name, lat, lng) => {
    expect(isInIndia(lat, lng)).toBe(false);
  });
});
