/** Emotes a walker can broadcast; "help" is a call for assistance. */
export type Emote = "wave" | "help" | "thanks";

export const EMOTE_LABEL: Record<Emote, { icon: string; text: string }> = {
  wave: { icon: "👋", text: "Hello!" },
  thanks: { icon: "🙏", text: "Thank you" },
  help: { icon: "🆘", text: "Need help here" },
};

/** One person in walk mode, as shared with everyone else. */
export interface Walker {
  id: string;
  name: string;
  /** Hex colour for their outfit, e.g. "#e4572e". */
  color: string;
  lat: number;
  lng: number;
  heading: number;
  gait: number;
  place: string;
  emote: Emote | null;
  /** Client counter; each new value is a fresh emote. */
  emoteSeq: number;
  /** Server time the current emote started. */
  emoteAt: number;
  updatedAt: number;
}

export type WalkerUpdate = Omit<Walker, "updatedAt" | "emoteAt">;

/** How long an emote bubble stays up. */
export const EMOTE_MS = 6000;

export interface PresenceSnapshot {
  walkers: Walker[];
  /** Server clock, to age emotes without trusting client clocks. */
  serverNow: number;
}

export const WALKER_COLORS = ["#e4572e", "#7b5cff", "#f0a202", "#2a9d8f", "#d62e7b", "#3a86ff", "#8ac926", "#ff7f11"];

/** Stable colour per walker id. */
export function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return WALKER_COLORS[h % WALKER_COLORS.length];
}
