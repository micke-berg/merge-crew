// A scenario is a list of steps that runs the same way through real git and through the engine.
//
// Actors: "player" works in the main worktree. Any other actor works in a linked worktree that an
// earlier step must create, e.g. { actor: "player", argv: ["git", "worktree", "add", "/crew/blaze", "-b", "blaze"] }.
// The last segment of the "/crew/<name>" path is the actor id.
//
// Commits are compared by message, so every commit in a scenario needs a unique message, and merge
// commits need an explicit -m.

import type { ActorId } from "@/engine/types";

/** What real git is expected to do with a step. Checked by the real-git self-test. Default "ok". */
export type Expect = { expect?: StepOutcome };

export type GitStep = { actor: ActorId; argv: string[] } & Expect;
export type WriteStep = { actor: ActorId; write: string; content: string } & Expect;
export type DeleteStep = { actor: ActorId; delete: string } & Expect;

export type ScenarioStep = GitStep | WriteStep | DeleteStep;

export type Scenario = {
  name: string;
  steps: ScenarioStep[];
};

export function isGitStep(step: ScenarioStep): step is GitStep {
  return "argv" in step;
}

export function isWriteStep(step: ScenarioStep): step is WriteStep {
  return "write" in step;
}

/** How a step ended. "stopped" means a nonzero exit that left an operation in progress or conflicts behind. */
export type StepOutcome = "ok" | "stopped" | "error";

export type StepRecord = {
  step: ScenarioStep;
  outcome: StepOutcome;
  /** Output for debugging mismatches. */
  output: string;
};

// Small builders keep scenario files short.
export const git = (actor: ActorId, line: string | string[]): GitStep => ({
  actor,
  argv: typeof line === "string" ? ["git", ...splitWords(line)] : ["git", ...line],
});
export const write = (actor: ActorId, path: string, content: string): WriteStep => ({ actor, write: path, content });
export const del = (actor: ActorId, path: string): DeleteStep => ({ actor, delete: path });
/** A git step that real git rejects with a nonzero exit and no state change expected beyond its error. */
export const fails = (step: GitStep): GitStep => ({ ...step, expect: "error" });
/** A git step that exits nonzero but leaves an operation in progress, e.g. a conflicting merge. */
export const stops = (step: GitStep): GitStep => ({ ...step, expect: "stopped" });

/** Write a file, stage it and commit it with the given message. */
export const commitFile = (actor: ActorId, path: string, content: string, message: string): ScenarioStep[] => [
  write(actor, path, content),
  git(actor, ["add", path]),
  git(actor, ["commit", "-m", message]),
];

/** Split on spaces, keeping "double quoted" groups together. Enough for scenario files. */
function splitWords(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2]);
  return out;
}
