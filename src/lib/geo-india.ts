/**
 * Coarse "is this point in India?" check, used to pick India's air-quality
 * index over the US one. A simplified outline (~80 vertices), so points within
 * a few km of a border may be misclassified. Not for anything legal.
 */

// [lng, lat], clockwise from Kanyakumari up the west coast.
const MAINLAND: [number, number][] = [
  [77.54, 8.08], [76.3, 9.5], [75.0, 12.5], [73.8, 15.4], [72.8, 19.0], [72.8, 20.4],
  [70.4, 20.8], [69.0, 22.3], [68.4, 23.0], [68.2, 23.7], [71.0, 24.4], [70.1, 25.5],
  [70.6, 27.0], [72.3, 28.0], [73.4, 29.9], [74.5, 30.9], [74.6, 32.5], [74.0, 33.5],
  [74.3, 34.6], [75.8, 36.0], [77.0, 35.6], [78.0, 35.5], [79.5, 34.0], [78.8, 32.6],
  [79.2, 31.2], [80.3, 30.4], [81.0, 30.2], [80.1, 28.9], [81.6, 27.9], [83.3, 27.4],
  [84.6, 27.3], [85.9, 26.6], [87.4, 26.4], [88.1, 26.4], [88.2, 27.1], [88.6, 28.1],
  [88.9, 27.3], [89.8, 26.7], [92.1, 26.8], [91.7, 27.8], [94.6, 29.3], [96.1, 29.4],
  [97.4, 28.2], [96.0, 27.2], [95.2, 26.6], [94.6, 25.2], [94.2, 23.9], [93.4, 22.6],
  [92.6, 21.95], [92.3, 23.7], [92.0, 25.15], [90.0, 25.25], [89.85, 25.3], [89.85, 26.3],
  [88.9, 26.3], [88.4, 26.45], [88.15, 26.0], [88.6, 25.2], [88.1, 24.6], [88.7, 24.3],
  [88.75, 22.9], [89.1, 21.6], [87.9, 21.6], [86.9, 20.8], [84.9, 19.3], [82.3, 16.6],
  [80.2, 15.8], [80.3, 13.1], [79.8, 11.0], [79.3, 10.3], [78.2, 8.9],
];

/** Island territories as boxes: Andaman & Nicobar, Lakshadweep. */
const ISLANDS = [
  { minLng: 92.2, maxLng: 94.0, minLat: 6.7, maxLat: 13.7 },
  { minLng: 71.7, maxLng: 74.0, minLat: 8.0, maxLat: 12.5 },
];

function inPolygon(lng: number, lat: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isInIndia(lat: number, lng: number): boolean {
  if (ISLANDS.some((b) => lng >= b.minLng && lng <= b.maxLng && lat >= b.minLat && lat <= b.maxLat)) return true;
  if (lat < 6 || lat > 37.5 || lng < 68 || lng > 97.5) return false;
  return inPolygon(lng, lat, MAINLAND);
}
