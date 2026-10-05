// Every colour the game uses, in one place.
//
// Components use these through Tailwind utilities (`bg-ink`, `text-muted`, `ring-focus/30`):
// the root layout writes each value below as a CSS variable (`--mc-<name>`), and globals.css maps
// those variables to Tailwind colour tokens. SVG drawing code imports the constants directly.
//
// palette.test.ts checks every text and background pair listed in TEXT_PAIRS against WCAG AA:
// 4.5:1 for text (1.4.3) and 3:1 for lines and markers (1.4.11).

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

const player = ACTOR_COLORS.player;

/** Named UI colours. Each becomes a Tailwind colour token of the same name. */
export const TOKENS = {
  // Surfaces, from the page outwards.
  paper: "#F7F1E5",
  "paper-dot": "#E4DACA",
  desk: "#EAE1D0",
  panel: "#FBF8F1",
  card: "#FFFDF8",
  sunk: "#F3ECDF",
  wash: "#F1EADC",
  chip: "#EDE5D6",
  overlay: "#2A2116",
  shadow: "#4A3A20",
  "shadow-dark": "#3B2F1E",

  // Borders.
  line: "#D8CCB5",
  "line-soft": "#E2D8C6",
  "line-strong": "#C9BCA4",
  "line-button": "#B9AD97",
  divider: "#CFC3AE",

  // Text, darkest first.
  ink: "#26283B",
  "ink-shadow": "#11121C",
  trunk: MAIN_COLOR.line,
  body: "#4A4436",
  soft: "#5D5649",
  /** Secondary text on light surfaces. */
  muted: "#71695D",
  /** Small text on the map paper, such as short commit ids. */
  "map-soft": "#6B6457",
  /** Lost commits: their lines and stops. Their labels use map-soft. */
  ghost: "#878073",
  "ghost-band": "#EEE6D6",
  "ghost-fill": "#F4EEE2",
  "tag-remote": "#E9E1D1",
  "tag-stash": "#FFF6DC",
  "art-ink": "#2B2433",

  // Keyboard focus.
  focus: player.line,

  // Done, fixed, solved.
  success: "#11876F",
  /** Green behind white text, or green text on a light card. */
  "success-strong": "#0F7F69",
  "success-deep": "#0B6B58",
  "success-ink": "#0B4F42",
  "success-wash": "#DDF1E9",
  "success-soft": "#EAF6F1",
  "success-tint": "#F4FBF8",
  "success-edge": "#BFE3D6",

  // Conflicts, warnings, force pushes.
  warn: "#C2410C",
  "warn-deep": "#8A2E0B",
  "warn-text": "#9A3412",
  "warn-ink": "#5A2A0E",
  "warn-note": "#8C5A3C",
  "warn-wash": "#FFF4EC",
  "warn-soft": "#FDEBE3",
  "warn-tint": "#FFF8F2",
  "warn-chip": "#FCE1D6",
  "warn-edge": "#F2C9AC",
  "warn-step": "#F2D9C6",
  "warn-strike": "#C9A58C",
  "warn-glow": "#FFC9B8",

  // File status badges.
  "modified-wash": "#FBE7C6",
  "modified-text": "#8A5A00",
  "deleted-text": "#B43A14",

  // The two sides of a conflict: mine is the player's blue, theirs is amber.
  "mine-text": player.deep,
  "mine-wash": "#EAF1FC",
  "mine-edge": "#B9CEF2",
  "mine-dot": player.line,
  "mine-mark": "#7FA9EE",
  "theirs-text": "#7A4A00",
  "theirs-wash": "#FDF4E3",
  "theirs-edge": "#EBCD97",
  "theirs-dot": "#C98500",
  "theirs-fill": "#E3A33A",
  "theirs-mark": "#F2C46B",

  // The command box. Its background is ink, its text is paper.
  "term-deep": "#1B1D2C",
  "term-muted": "#8D90A8",
  "term-dim": "#A9ABBF",
  "term-out": "#D9DBE8",
  "term-key": "#C9CBDA",
  "term-edge": "#44475F",
  "term-edge-soft": "#5E6178",
  "term-prompt": "#7FD1B9",
  "term-hint": "#E9C46A",
  "term-error": "#FF9C85",
} as const;

export type Token = keyof typeof TOKENS;

// Shorthands for the SVG map.
export const PAPER = TOKENS.paper;
export const PAPER_DOT = TOKENS["paper-dot"];
export const INK = TOKENS.ink;
export const INK_SOFT = TOKENS["map-soft"];
export const GHOST = TOKENS.ghost;
export const WARN = TOKENS.warn;

/**
 * Every colour as a CSS custom property, for the root element: the UI tokens as `--mc-<name>`
 * and each robot's colours as `--mc-robot-<id>`, `--mc-robot-<id>-deep` and `--mc-robot-<id>-tint`.
 */
export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(TOKENS)) vars[`--mc-${name}`] = value;
  for (const [id, c] of Object.entries(ACTOR_COLORS)) {
    vars[`--mc-robot-${id}`] = c.line;
    vars[`--mc-robot-${id}-deep`] = c.deep;
    vars[`--mc-robot-${id}-tint`] = c.tint;
  }
  return vars;
}

/** Robot colours are tuned for paper; lift them a little for the dark command box. */
export function lighten(hex: string, amount = 0.35): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

type Pair = { text: string; on: string; min: 3 | 4.5; what: string };

/** Pure white, for label text on coloured pills and the inside of stops. */
export const WHITE = "#FFFFFF";
const t = TOKENS;

/** Every foreground and background combination the UI draws, with the contrast it needs. */
export const TEXT_PAIRS: Pair[] = [
  ...(["paper", "desk", "panel", "card", "sunk", "wash", "chip", "ghost-band"] as const).map((on) => ({
    text: t.ink, on: t[on], min: 4.5 as const, what: `ink on ${on}`,
  })),
  ...(["paper", "card"] as const).map((on) => ({ text: t.body, on: t[on], min: 4.5 as const, what: `body on ${on}` })),
  ...(["paper", "panel", "card", "sunk", "wash", "chip"] as const).map((on) => ({
    text: t.soft, on: t[on], min: 4.5 as const, what: `soft on ${on}`,
  })),
  ...(["paper", "panel", "card", "sunk", "wash", "warn-wash", "mine-wash", "theirs-wash"] as const).map((on) => ({
    text: t.muted, on: t[on], min: 4.5 as const, what: `muted on ${on}`,
  })),
  ...(["paper", "ghost-band"] as const).map((on) => ({ text: t["map-soft"], on: t[on], min: 4.5 as const, what: `map-soft on ${on}` })),
  ...(["paper", "ghost-band", "panel", "ghost-fill"] as const).map((on) => ({ text: t.ghost, on: t[on], min: 3 as const, what: `ghost line on ${on}` })),

  // The command box.
  ...(["paper", "term-out", "term-dim", "term-key", "term-muted", "term-prompt", "term-hint", "term-error", "warn-glow"] as const).map(
    (name) => ({ text: t[name], on: t.ink, min: 4.5 as const, what: `${name} on the command box` }),
  ),
  ...(["paper", "term-muted", "term-prompt", "term-hint"] as const).map((name) => ({
    text: t[name], on: t["term-deep"], min: 4.5 as const, what: `${name} on the command input`,
  })),
  { text: t.paper, on: t.trunk, min: 4.5, what: "paper on the trunk" },

  // Status.
  { text: WHITE, on: t["success-strong"], min: 4.5, what: "white on success-strong" },
  { text: t["success-strong"], on: t.card, min: 4.5, what: "success-strong on card" },
  { text: WHITE, on: t.success, min: 3, what: "white check on success" },
  { text: t["success-deep"], on: t["success-wash"], min: 4.5, what: "success-deep on success-wash" },
  { text: t["success-deep"], on: WHITE, min: 4.5, what: "success-deep on white" },
  { text: t["success-ink"], on: t["success-soft"], min: 4.5, what: "success-ink on success-soft" },
  { text: t.warn, on: t.card, min: 4.5, what: "warn on card" },
  { text: WHITE, on: t.warn, min: 4.5, what: "white on warn" },
  ...(["warn-wash", "warn-soft", "warn-step"] as const).map((on) => ({ text: t["warn-deep"], on: t[on], min: 4.5 as const, what: `warn-deep on ${on}` })),
  { text: t["warn-text"], on: t["warn-chip"], min: 4.5, what: "warn-text on warn-chip" },
  { text: t["warn-ink"], on: t["warn-wash"], min: 4.5, what: "warn-ink on warn-wash" },
  { text: t["warn-note"], on: t["warn-wash"], min: 4.5, what: "warn-note on warn-wash" },
  { text: t["modified-text"], on: t["modified-wash"], min: 4.5, what: "modified-text on modified-wash" },
  { text: t["deleted-text"], on: t["warn-chip"], min: 4.5, what: "deleted-text on warn-chip" },
  { text: t["mine-text"], on: t["mine-wash"], min: 4.5, what: "mine-text on mine-wash" },
  { text: t["theirs-text"], on: t["theirs-wash"], min: 4.5, what: "theirs-text on theirs-wash" },
  { text: WHITE, on: t.overlay, min: 4.5, what: "white on overlay" },

  // Robot colours.
  { text: MAIN_COLOR.line, on: t.paper, min: 3, what: "main line on paper" },
  { text: WHITE, on: MAIN_COLOR.deep, min: 4.5, what: "white label on main" },
  ...Object.entries(ACTOR_COLORS).flatMap(([id, c]) => [
    { text: c.line, on: t.paper, min: 3 as const, what: `${id} line on paper` },
    { text: WHITE, on: c.deep, min: 4.5 as const, what: `white label on ${id} deep` },
    { text: c.deep, on: t.card, min: 4.5 as const, what: `${id} name on card` },
    { text: c.deep, on: t.sunk, min: 4.5 as const, what: `${id} name on sunk` },
    { text: lighten(c.line), on: t.ink, min: 4.5 as const, what: `${id} prompt in the command box` },
  ]),
];

// --- contrast helpers ---

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
