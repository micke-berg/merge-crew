// How the job bar reads a level's goals: steps to do, and rules to keep. Pure.

import type { Goal } from "@/engine/types";

export type JobLine = { goal: Goal; done: boolean };

export type Job = {
  /** Goals the player has to make true, in level order. */
  steps: JobLine[];
  /** Goals that were already true when the player's turn began: they only have to stay true. */
  rules: JobLine[];
  /** The line to work on now: the first unmet step, or a broken rule when every step is done. */
  current: Goal | null;
};

/**
 * Split a level's goals for the job bar. A goal met before the player has done anything is not a
 * finished step: showing it ticked ("1 of 3 done") tells the player nothing. It is a rule, shown
 * apart, and it only draws attention when a command breaks it.
 */
export function readJob(goals: readonly Goal[], done: readonly boolean[], kept: readonly boolean[]): Job {
  const lines = goals.map((goal, i) => ({ goal, done: done[i] ?? false, rule: kept[i] ?? false }));
  const steps = lines.filter((l) => !l.rule).map(({ goal, done }) => ({ goal, done }));
  const rules = lines.filter((l) => l.rule).map(({ goal, done }) => ({ goal, done }));
  const current = (steps.find((l) => !l.done) ?? rules.find((l) => !l.done))?.goal ?? null;
  return { steps, rules, current };
}
