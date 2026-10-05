// Builds the /api/hint request from the game state, and sends it. The request carries only what
// the player can already see: their recent commands, which goals are met and a status summary.

import { queries } from "@/engine";
import { LIMITS, MAX_RECENT_COMMANDS, type HintRequest, type HintResponse, type RecentCommand } from "@/hints/types";
import type { GameState } from "./game";

const OUTPUT_LINES = 3;

/** Messages of the commits `git stash` makes for itself. */
const STASH_MESSAGE = /^(WIP on|On|index on|untracked files on) [^:]+: /;

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** The player's own commands from the terminal log, oldest first, each with its first output lines. */
export function recentCommands(game: GameState, max = MAX_RECENT_COMMANDS): RecentCommand[] {
  const out: { command: string; lines: string[]; ok: boolean }[] = [];
  let current: (typeof out)[number] | null = null;
  for (const line of game.log) {
    if (line.kind === "note") {
      current = null;
      continue;
    }
    if (line.actor !== "player" || line.scripted) {
      current = null;
      continue;
    }
    if (line.kind === "command") {
      current = { command: line.text, lines: [], ok: true };
      out.push(current);
    } else if (current) {
      if (line.kind === "error") current.ok = false;
      if (line.text.trim()) current.lines.push(line.text);
    }
  }
  return out.slice(-max).map((c) => ({
    command: clip(c.command, LIMITS.command),
    outputFirstLines: clip(c.lines.slice(0, OUTPUT_LINES).join("\n"), LIMITS.output),
    ok: c.ok,
  }));
}

/** A short `git status`-like line about the player's checkout, plus how many commits are lost. */
export function statusSummary(game: GameState): string {
  const repo = game.repo;
  const branch = queries.currentBranch(repo, "player");
  const head = repo.worktrees.player?.head;
  const parts: string[] = [branch ? `On branch ${branch}.` : head?.kind === "detached" ? "HEAD is detached." : "No branch checked out."];
  const st = queries.status(repo, "player");
  if (st.conflicted.length) parts.push(`Conflicts: ${st.conflicted.join(", ")}.`);
  if (st.staged.length) parts.push(`Staged: ${st.staged.map((f) => `${f.path} (${f.change})`).join(", ")}.`);
  if (st.unstaged.length) parts.push(`Not staged: ${st.unstaged.map((f) => `${f.path} (${f.change})`).join(", ")}.`);
  if (st.untracked.length) parts.push(`Untracked: ${st.untracked.join(", ")}.`);
  if (!st.conflicted.length && !st.staged.length && !st.unstaged.length && !st.untracked.length) parts.push("Working tree clean.");
  // A dropped or popped stash leaves its internal commits unreachable; those are not "lost work".
  const lost = queries.lost(repo).filter((oid) => !STASH_MESSAGE.test(repo.commits[oid]?.message ?? "")).length;
  if (lost) parts.push(`${lost} commit${lost === 1 ? " is" : "s are"} not reachable from any branch.`);
  return clip(parts.join(" "), LIMITS.statusSummary);
}

export function buildHintRequest(game: GameState, hintNumber: number, runId?: string): HintRequest {
  return {
    levelId: game.level.id,
    hintNumber,
    recentCommands: recentCommands(game),
    goals: [...game.goals],
    statusSummary: statusSummary(game),
    ...(runId ? { runId } : {}),
  };
}

/** A fresh random id for one play of a level. */
export function newRunId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** What Tidy says when the hint service cannot answer. The hint is given back in these cases. */
export const OFFLINE_HINT = "I can't reach my notes right now. Try git status and read it slowly, it usually tells you what's next.";
export const BUSY_HINT = "I need a short breather. Ask me again in a minute, and try git status meanwhile.";

export type HintResult = { text: string; refund: boolean };

/** Ask the server for a hint. Never throws: a failed request becomes a gentle line, and the hint is refunded. */
export async function fetchHint(request: HintRequest, signal?: AbortSignal): Promise<HintResult> {
  try {
    const res = await fetch("/api/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (res.status === 429) return { text: BUSY_HINT, refund: true };
    if (!res.ok) return { text: OFFLINE_HINT, refund: true };
    const body = (await res.json()) as Partial<HintResponse>;
    if (typeof body.text !== "string" || !body.text.trim()) return { text: OFFLINE_HINT, refund: true };
    return { text: body.text, refund: false };
  } catch {
    return { text: OFFLINE_HINT, refund: true };
  }
}
