/**
 * HTML builders for MapLibre markers and popups. MapLibre takes raw HTML, so
 * every interpolated value goes through `esc()` — report text is user input.
 */

export const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ICONS = {
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  buoy:
    '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M12 11v6"/><path d="M9 14h6"/>',
  waves:
    '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
} as const;

export type MarkerIcon = keyof typeof ICONS;

const svg = (icon: MarkerIcon, size = 14) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</svg>`;

/** Round pin with a ring the colour of the canvas so it separates from tiles. */
export function pinHTML(opts: { icon: MarkerIcon; bg: string; count?: number; square?: boolean }) {
  const shape = opts.square ? "rounded-[9px]" : "rounded-full";
  return `
    <div class="relative grid place-items-center transition-transform duration-150 hover:scale-110 hover:-translate-y-0.5">
      <div class="size-8 ${shape} ${opts.bg} text-white grid place-items-center ring-[2.5px] ring-canvas shadow-[0_4px_12px_-2px_rgb(0_0_0/0.35)]">
        ${svg(opts.icon)}
      </div>
      ${
        opts.count && opts.count > 1
          ? `<span class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-surface text-ink font-mono text-[10px] font-semibold grid place-items-center ring-1 ring-line shadow">${opts.count}</span>`
          : ""
      }
    </div>`;
}

/** Blurred privacy area for public SOS display (~1 km). */
export function sosAreaHTML() {
  return `
    <div class="relative grid place-items-center">
      <div class="size-20 rounded-full bg-red-500/12 border border-red-500/40 border-dashed"></div>
      <div class="absolute size-7 rounded-full bg-danger text-white grid place-items-center ring-[2.5px] ring-canvas shadow-lg">${svg("buoy", 13)}</div>
    </div>`;
}

/** Precise SOS pin with a single steady ring (responder view). */
export function sosPinHTML() {
  return `
    <div class="relative grid place-items-center">
      <span class="absolute size-8 rounded-full bg-danger/40 animate-ping [animation-duration:2.2s]"></span>
      <div class="size-8 rounded-full bg-danger text-white grid place-items-center ring-[2.5px] ring-canvas shadow-lg">${svg("buoy")}</div>
    </div>`;
}

/** Pill label for area-level estimates. */
export function labelHTML(text: string, bg: string) {
  return `
    <div class="h-7 pl-1.5 pr-2.5 rounded-full ${bg} text-white flex items-center gap-1.5 text-[11.5px] font-semibold ring-[2.5px] ring-canvas shadow-[0_4px_12px_-2px_rgb(0_0_0/0.35)] whitespace-nowrap transition-transform hover:scale-105">
      <span class="size-5 rounded-full bg-white/20 grid place-items-center">${svg("waves", 12)}</span>
      ${esc(text)}
    </div>`;
}

const BADGE: Record<string, string> = {
  neutral: "bg-surface-3 text-ink-muted",
  accent: "bg-accent-soft text-accent-ink",
  ok: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/14 text-amber-800 dark:text-amber-300",
  danger: "bg-danger-soft text-danger",
  risk: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
};

/** Shared popup layout. `body`, `meta` and `footer` must already be escaped. */
export function popupHTML(opts: {
  badge: string;
  tone: keyof typeof BADGE;
  code?: string;
  title: string;
  body?: string;
  meta?: string;
  footer?: string;
}) {
  return `
    <div class="w-[272px] p-4 font-sans">
      <div class="flex items-center justify-between gap-2 pr-5">
        <span class="inline-flex items-center h-[22px] px-2 rounded-md text-[11.5px] font-medium ${BADGE[opts.tone]}">${esc(opts.badge)}</span>
        ${opts.code ? `<span class="font-mono text-[11px] text-ink-subtle">${esc(opts.code)}</span>` : ""}
      </div>
      <h4 class="mt-2.5 text-[14.5px] font-semibold leading-snug text-ink">${esc(opts.title)}</h4>
      ${opts.body ? `<p class="mt-1 text-[12.5px] leading-relaxed text-ink-muted">${opts.body}</p>` : ""}
      ${opts.meta ? `<div class="mt-3 text-[12px] text-ink-subtle">${opts.meta}</div>` : ""}
      ${opts.footer ?? ""}
    </div>`;
}

/**
 * "You are here": accuracy ring (sized in px by the map on zoom), an optional
 * heading cone, and the location dot. Root is 0×0 so the marker anchors on
 * the exact coordinate.
 */
export function userLocationHTML() {
  return `
    <div class="relative size-0 pointer-events-none">
      <div data-accuracy class="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/12 border border-accent/35 transition-[width,height] duration-300"></div>
      <div data-heading class="absolute left-0 top-0 hidden" style="transform-origin:0 0">
        <div class="absolute -translate-x-1/2 -translate-y-full w-9 h-11 bg-gradient-to-t from-accent/55 to-transparent [clip-path:polygon(50%_100%,0_0,100%_0)]"></div>
      </div>
      <span class="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 size-8 rounded-full bg-accent/30 animate-ping [animation-duration:2.4s]"></span>
      <div class="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 size-[18px] rounded-full bg-accent ring-[3px] ring-white shadow-[0_2px_8px_rgb(0_0_0/0.35)]"></div>
    </div>`;
}

/** Location the user chose on the map (fallback when GPS is unavailable). */
export function manualLocationHTML() {
  return `
    <div class="flex flex-col items-center pointer-events-none">
      <span class="mb-1 h-5 px-1.5 rounded bg-ink text-canvas text-[10.5px] font-medium grid place-items-center whitespace-nowrap shadow">Your location (set manually)</span>
      <div class="size-4 rounded-full bg-ink ring-[3px] ring-white shadow-[0_2px_8px_rgb(0_0_0/0.35)]"></div>
    </div>`;
}
