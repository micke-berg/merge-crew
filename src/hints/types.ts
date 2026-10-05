// The hint request and response, shared by the browser and the /api/hint route.
// Client-safe: no level knowledge, no answers. The hint context and the scripted hints live in
// server-only modules (src/hints/data), so they never reach the browser bundle.

/** Hints a player may ask for in one run of a level. Restarting the level starts a new run. */
export const MAX_HINTS_PER_RUN = 5;

/** How many of the player's latest commands go with a hint request. */
export const MAX_RECENT_COMMANDS = 8;

/** Size limits for every field of a request. The route rejects anything bigger. */
export const LIMITS = {
  /** The whole JSON body, in bytes. */
  bodyBytes: 8 * 1024,
  levelId: 32,
  command: 200,
  output: 400,
  statusSummary: 400,
  goals: 12,
  runId: 64,
} as const;

/** One command the player ran: the line, the first lines of what came back, and whether git accepted it. */
export type RecentCommand = { command: string; outputFirstLines: string; ok: boolean };

export type HintRequest = {
  levelId: string;
  /** 1 for the first hint of this run, up to MAX_HINTS_PER_RUN. Picks the scripted fallback. */
  hintNumber: number;
  /** Oldest first, at most MAX_RECENT_COMMANDS. */
  recentCommands: RecentCommand[];
  /** One entry per level goal, in order: met or not. */
  goals: boolean[];
  /** A short `git status`-like summary of the player's checkout. */
  statusSummary: string;
  /**
   * A random id for this play of the level, made in the browser. Tracing groups the hints of one
   * run into one session with it. Carries nothing about the player.
   */
  runId?: string;
};

/** Why a scripted hint was used instead of the model's. */
export type FallbackReason =
  | "disabled"
  | "no-credentials"
  | "model-error"
  | "timeout"
  | "empty"
  | "too-long"
  | "leak-solution"
  | "leak-force";

export type HintResponse = {
  text: string;
  /** Who wrote the hint: the model, or the level's scripted list. */
  source: "ai" | "scripted";
  /** Set when source is "scripted": why the model's hint was not used. */
  reason?: FallbackReason;
};
