// The daily incident: one level a day, the same for every player, picked from a pool by the date.
// Pure: no clock and no storage in here, the caller passes them in.

import type { Level } from "@/engine/types";
import { everyLevel } from "@/levels";

/**
 * The levels that can be the day's incident, in pool order: the acts' levels where a robot breaks
 * something or hides something, and the incidents made only for the daily. All have a par. Levels with rule cards are left out, because the pick
 * decides how much there is to fix and two players' results could not be compared.
 */
export const DAILY_POOL: readonly string[] = everyLevel.filter((l) => l.act >= 2 && l.par !== undefined && !l.shift).map((l) => l.id);

/** Day 1 of the daily incident, as a UTC date. */
export const FIRST_DAY = Date.UTC(2026, 10, 11);
const DAY_MS = 24 * 60 * 60 * 1000;

/** The incident number for a moment in time: 1 on the first day, counted in UTC days so everyone shares it. */
export function dayNumber(now: Date | number): number {
  const t = typeof now === "number" ? now : now.getTime();
  return Math.floor((t - FIRST_DAY) / DAY_MS) + 1;
}

/** A small deterministic generator, so the pool's order in each round is the same for everyone. */
function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The pool in the order it is played in round `round` (0 for the first pass through the pool).
 * Each round is a fresh shuffle, and never starts with the incident the round before ended on.
 */
export function roundOrder(round: number, pool: readonly string[] = DAILY_POOL): string[] {
  const order = [...pool];
  const next = seeded(round + 1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (round > 0 && order.length > 1) {
    const before = roundOrder(round - 1, pool);
    if (order[0] === before[before.length - 1]) order.push(order.shift()!);
  }
  return order;
}

/** The level id of incident `number` (1 or more). Null before day 1 or with an empty pool. */
export function incidentId(number: number, pool: readonly string[] = DAILY_POOL): string | null {
  if (number < 1 || pool.length === 0) return null;
  const at = number - 1;
  return roundOrder(Math.floor(at / pool.length), pool)[at % pool.length];
}

export function incidentLevel(number: number): Level | null {
  const id = incidentId(number);
  return (id && everyLevel.find((l) => l.id === id)) || null;
}

export type DailyRecord = {
  /** The last incident number the player solved. 0 when none. */
  last: number;
  /** Days solved in a row, ending at `last`. */
  streak: number;
  /** The longest streak so far. */
  best: number;
  /** Fewest moves and hints for each solved incident number. */
  results: Record<string, { moves: number; hints: number }>;
};

export const NO_RECORD: DailyRecord = { last: 0, streak: 0, best: 0, results: {} };

/** The record after solving incident `number`. Solving the same day again keeps the better result and the streak. */
export function recordSolve(record: DailyRecord, number: number, result: { moves: number; hints: number }): DailyRecord {
  const before = record.results[String(number)];
  const better = !before || result.moves < before.moves || (result.moves === before.moves && result.hints < before.hints);
  const results = better ? { ...record.results, [String(number)]: result } : record.results;
  if (number <= record.last) return results === record.results ? record : { ...record, results };
  const streak = number === record.last + 1 ? record.streak + 1 : 1;
  return { last: number, streak, best: Math.max(record.best, streak), results };
}

/** The streak as it stands on day `today`: it is lost once a whole day was missed. */
export function currentStreak(record: DailyRecord, today: number): number {
  return record.last >= today - 1 ? record.streak : 0;
}

/** A stored record read back safely: anything odd becomes an empty record. */
export function parseRecord(raw: string | null): DailyRecord {
  if (!raw) return NO_RECORD;
  try {
    const v = JSON.parse(raw) as Partial<DailyRecord> | null;
    const int = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : 0);
    if (typeof v !== "object" || v === null) return NO_RECORD;
    const results: DailyRecord["results"] = {};
    for (const [day, r] of Object.entries(typeof v.results === "object" && v.results !== null ? v.results : {})) {
      if (/^\d+$/.test(day) && typeof r === "object" && r !== null) results[day] = { moves: int(r.moves), hints: int(r.hints) };
    }
    return { last: int(v.last), streak: int(v.streak), best: int(v.best), results };
  } catch {
    return NO_RECORD;
  }
}

/**
 * The result as plain text to paste anywhere, with no spoilers: no command and no branch name.
 * Example: "Merge Crew #12 · Blaze was in a hurry · 4 commands (par 4) · no hints".
 */
export function shareText(input: { number?: number; title: string; moves: number; par?: number; hints: number; url: string }): string {
  const head = input.number === undefined ? "Merge Crew" : `Merge Crew #${input.number}`;
  const count = `${input.moves} ${input.moves === 1 ? "command" : "commands"}${input.par === undefined ? "" : ` (par ${input.par})`}`;
  const hints = input.hints === 0 ? "no hints" : `${input.hints} ${input.hints === 1 ? "hint" : "hints"}`;
  return `${head} · ${input.title} · ${count} · ${hints}\n${input.url}`;
}

/** The count to beat from a challenge link's `?beat=` value, or null when it is not a sensible number. */
export function parseBeat(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 ? n : null;
}
