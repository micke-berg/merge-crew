// Every level's hint data and documented solution, keyed by level id. Server-only: imported by the
// /api/hint route, the hint tests and the evals, never by client code.

import "server-only";
import { levels } from "@/levels";
import { solutions } from "@/levels/solutions";
import type { Level } from "@/engine/types";
import type { SolutionCommand } from "../leak";
import { hints as act1_01 } from "./act1-01-first-save";
import { hints as act1_02 } from "./act1-02-your-own-line";
import { hints as act1_03 } from "./act1-03-bringing-it-home";
import { hints as act1_04 } from "./act1-04-the-shared-copy";
import { hints as act2_01 } from "./act2-01-blaze-was-in-a-hurry";
import { hints as act2_02 } from "./act2-02-drifts-long-walk";
import { hints as act2_03 } from "./act2-03-hoarders-secret-pile";
import { hints as act2_04 } from "./act2-04-undo-politely";
import { hints as act2_05 } from "./act2-05-just-that-one-fix";
import type { LevelHints } from "./types";

export type { LevelHints } from "./types";

const HINTS: Readonly<Record<string, LevelHints>> = {
  "act1-01": act1_01,
  "act1-02": act1_02,
  "act1-03": act1_03,
  "act1-04": act1_04,
  "act2-01": act2_01,
  "act2-02": act2_02,
  "act2-03": act2_03,
  "act2-04": act2_04,
  "act2-05": act2_05,
};

/** Everything the hint route knows about one level. */
export type HintLevel = LevelHints & {
  level: Level;
  /** The documented solution's git commands, for the answer-leak check. */
  solution: SolutionCommand[];
};

export function hintLevel(levelId: string): HintLevel | undefined {
  const level = levels.find((l) => l.id === levelId);
  const data = HINTS[levelId];
  if (!level || !data) return undefined;
  const solution = (solutions[levelId] ?? []).flatMap((step) => (step.kind === "git" ? [step.argv] : []));
  return { ...data, level, solution };
}

/** Level ids that have hint data. */
export const hintLevelIds: readonly string[] = Object.keys(HINTS);
