// Every colour the history map uses, in one place.
// Lines must reach 3:1 against the paper (graphical objects, WCAG 1.4.11).
// Text sits on `deep` in white, which must reach 4.5:1 (WCAG 1.4.3). palette.test.ts checks both.

import type { ActorId } from "@/engine/types";

export type ActorColor = {
  /** Line and marker colour. */
  line: string;
  /** Darker shade used behind white label text. */
  deep: string;
  /** Pale wash for soft fills, such as the robot's face screen. */
  tint: string;
  /** Display name shown next to the marker. */
  name: string;
};

export const PAPER = "#F7F1E5";
export const PAPER_DOT = "#E4DACA";
export const INK = "#26283B";
export const INK_SOFT = "#6B6457";
export const GHOST = "#9A9184";
export const WARN = "#C2410C";

/** The trunk line. Shared by everyone, so it is not any robot's colour. */
export const MAIN_COLOR: ActorColor = { line: "#2A2D45", deep: "#2A2D45", tint: "#E6E4EE", name: "main" };

export const ACTOR_COLORS: Record<string, ActorColor> = {
  player: { line: "#2563C9", deep: "#1D4FA3", tint: "#DCE8FA", name: "You" },
  tidy: { line: "#11876F", deep: "#0B6B58", tint: "#D3F0E8", name: "Tidy" },
  blaze: { line: "#D9461B", deep: "#B43A14", tint: "#FCE1D6", name: "Blaze" },
  drift: { line: "#7C4DC4", deep: "#653AA8", tint: "#E9DEF8", name: "Drift" },
  hoarder: { line: "#A87400", deep: "#7F5800", tint: "#F7E8C2", name: "Hoarder" },
};

/** Stable display order for markers and legends. */
export const ACTOR_ORDER: ActorId[] = ["player", "tidy", "blaze", "drift", "hoarder"];

const FALLBACKS: ActorColor[] = [
  { line: "#0E7490", deep: "#0B5C72", tint: "#D4EEF4", name: "" },
  { line: "#BE185D", deep: "#9D134C", tint: "#F9DAE7", name: "" },
  { line: "#4D7C0F", deep: "#3D630B", tint: "#E3F0D0", name: "" },
];

export function actorColor(actor: ActorId | null | undefined): ActorColor {
  if (!actor) return MAIN_COLOR;
  const known = ACTOR_COLORS[actor];
  if (known) return known;
  let h = 0;
  for (const ch of actor) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const base = FALLBACKS[h % FALLBACKS.length];
  return { ...base, name: actor.charAt(0).toUpperCase() + actor.slice(1) };
}

export function actorName(actor: ActorId): string {
  return actorColor(actor).name;
}

// --- contrast helpers (used by tests) ---

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
