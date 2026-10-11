/**
 * Snap Map-style avatars: a cartoon head-and-shoulders generated from a
 * stable seed (the walker id), so the same person always looks the same.
 */

const SKIN = ["#f6d2b0", "#eab98f", "#d39a6a", "#b57a4c", "#8d5634", "#6b3f24"];
const HAIR = ["#1d1512", "#3b2418", "#6a4330", "#a5612f", "#d8b26a", "#2b2b38"];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Deterministic features for a seed. */
export function avatarFeatures(seed: string) {
  const h = hash(seed);
  return {
    skin: SKIN[h % SKIN.length],
    hair: HAIR[(h >>> 4) % HAIR.length],
    style: (h >>> 8) % 4, // 0 short, 1 long, 2 bun, 3 cap
    glasses: (h >>> 12) % 5 === 0,
  };
}

const HAIR_PATHS = [
  // short
  '<path d="M18 28c0-10 6-16 14-16s14 6 14 16c-3-5-8-7-14-7s-11 2-14 7z"/>',
  // long
  '<path d="M16 30c0-12 7-18 16-18s16 6 16 18v12c-2-4-3-10-3-14-3-4-8-6-13-6s-10 2-13 6c0 4-1 10-3 14z"/>',
  // bun
  '<circle cx="32" cy="9" r="5"/><path d="M18 28c0-10 6-15 14-15s14 5 14 15c-3-5-8-7-14-7s-11 2-14 7z"/>',
  // cap (brim + crown)
  '<path d="M17 25c1-9 7-14 15-14s14 5 15 14z"/><path d="M30 24h22c0 2-2 3-4 3H30z"/>',
];

/** SVG markup for an avatar. `color` is the outfit colour (hex). */
export function avatarSVG(seed: string, color: string): string {
  const f = avatarFeatures(seed);
  const hairFill = f.style === 3 ? color : f.hair;
  // Ids are document-wide, so make the clip path unique per avatar seed.
  const clip = `nl-av-${hash(seed).toString(36)}`;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="32" cy="32" r="31" fill="#fff"/>
    <clipPath id="${clip}"><circle cx="32" cy="32" r="28"/></clipPath>
    <g clip-path="url(#${clip})">
      <rect width="64" height="64" fill="${color}" opacity="0.22"/>
      <path d="M12 64c0-12 9-19 20-19s20 7 20 19z" fill="${color}"/>
      <rect x="28" y="38" width="8" height="9" rx="3" fill="${f.skin}"/>
      <ellipse cx="32" cy="29" rx="13" ry="14" fill="${f.skin}"/>
      <g fill="${hairFill}">${HAIR_PATHS[f.style]}</g>
      <circle cx="27" cy="30" r="1.8" fill="#1d1512"/>
      <circle cx="37" cy="30" r="1.8" fill="#1d1512"/>
      ${f.glasses ? '<g fill="none" stroke="#1d1512" stroke-width="1.4"><circle cx="27" cy="30" r="4"/><circle cx="37" cy="30" r="4"/><path d="M31 30h2"/></g>' : ""}
      <path d="M27.5 35.5c2.5 2.6 6.5 2.6 9 0" fill="none" stroke="#7a3b2a" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="23.5" cy="34" r="2" fill="#f28c8c" opacity="0.45"/>
      <circle cx="40.5" cy="34" r="2" fill="#f28c8c" opacity="0.45"/>
    </g>
  </svg>`;
}

/**
 * Avatar diameter on the 2D / 3D map: small when zoomed out, growing as you
 * zoom in, like Snap Map.
 */
export function avatarSizePx(zoom: number): number {
  return Math.round(Math.min(76, Math.max(22, 22 + (zoom - 9) * 7)));
}

/**
 * On-screen height of a 3D walker: about 90 px at walking zoom, growing when
 * you zoom in and shrinking when you zoom out.
 */
export function characterHeightPx(zoom: number): number {
  return Math.min(150, Math.max(36, 90 * 1.35 ** (zoom - 17.6)));
}
