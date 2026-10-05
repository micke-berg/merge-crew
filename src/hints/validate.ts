// Strict parsing of a hint request body. Pure: no level knowledge beyond what the caller passes in.

import { LIMITS, MAX_HINTS_PER_RUN, MAX_RECENT_COMMANDS, type HintRequest, type RecentCommand } from "./types";

export type ParseResult = { ok: true; request: HintRequest } | { ok: false; error: string };

/** Control characters other than newline and tab are dropped, so nothing odd reaches the prompt. */
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function onlyKeys(o: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(o).every((k) => keys.includes(k));
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string" || v.length > max) return null;
  return v.replace(CONTROL, "");
}

/**
 * Check a decoded JSON body against the request shape and its size limits. Unknown fields, wrong
 * types and oversized strings are rejected rather than trimmed: a real client never sends them.
 * `goalCountFor` returns a level's number of goals, or undefined for an unknown level id.
 */
export function parseHintRequest(body: unknown, goalCountFor: (levelId: string) => number | undefined): ParseResult {
  if (!isPlainObject(body)) return { ok: false, error: "body must be an object" };
  if (!onlyKeys(body, ["levelId", "hintNumber", "recentCommands", "goals", "statusSummary"])) {
    return { ok: false, error: "unknown field" };
  }
  const levelId = text(body.levelId, LIMITS.levelId);
  if (!levelId) return { ok: false, error: "levelId" };
  const goalCount = goalCountFor(levelId);
  if (goalCount === undefined) return { ok: false, error: "unknown level" };

  const hintNumber = body.hintNumber;
  if (typeof hintNumber !== "number" || !Number.isInteger(hintNumber) || hintNumber < 1 || hintNumber > MAX_HINTS_PER_RUN) {
    return { ok: false, error: "hintNumber" };
  }

  if (!Array.isArray(body.recentCommands) || body.recentCommands.length > MAX_RECENT_COMMANDS) {
    return { ok: false, error: "recentCommands" };
  }
  const recentCommands: RecentCommand[] = [];
  for (const c of body.recentCommands) {
    if (!isPlainObject(c) || !onlyKeys(c, ["command", "outputFirstLines", "ok"])) return { ok: false, error: "recentCommands" };
    const command = text(c.command, LIMITS.command);
    const outputFirstLines = text(c.outputFirstLines, LIMITS.output);
    if (command === null || outputFirstLines === null || typeof c.ok !== "boolean") return { ok: false, error: "recentCommands" };
    recentCommands.push({ command, outputFirstLines, ok: c.ok });
  }

  const goals = body.goals;
  if (
    !Array.isArray(goals) ||
    goals.length > LIMITS.goals ||
    goals.length !== goalCount ||
    !goals.every((g) => typeof g === "boolean")
  ) {
    return { ok: false, error: "goals" };
  }

  const statusSummary = text(body.statusSummary, LIMITS.statusSummary);
  if (statusSummary === null) return { ok: false, error: "statusSummary" };

  return { ok: true, request: { levelId, hintNumber, recentCommands, goals: goals as boolean[], statusSummary } };
}
