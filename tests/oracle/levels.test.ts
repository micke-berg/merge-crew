// Real git referees every level: setup, the git and edit steps of the intro, and the documented
// solution run through the git CLI and through the engine, and the end states must match. Talk,
// mood and pause steps have no effect on the repository and are skipped. Every step of a solution
// must also succeed in real git (a conflict that stops a merge counts as success).

import { availableParallelism } from "node:os";
import { beforeAll, describe, expect, it } from "vitest";
import { levels } from "@/levels";
import { solutions } from "@/levels/solutions";
import type { Level, ScriptStep } from "@/engine/types";
import { engine } from "@/engine";
import { diffOutcomes, diffSnapshots, formatDiff } from "./compare";
import { runEngine } from "./engine-run";
import { runRealGit, type RealGitResult } from "./real-git";
import type { Scenario, ScenarioStep } from "./scenario";
import { fromEngine } from "./snapshot";

/** The oracle form of a script step, or null for steps that do not touch the repository. */
function toScenarioStep(step: ScriptStep): ScenarioStep | null {
  switch (step.kind) {
    case "git":
      return { actor: step.actor, argv: step.argv };
    case "edit":
      return step.edit.kind === "write"
        ? { actor: step.edit.actor, write: step.edit.path, content: step.edit.content }
        : { actor: step.edit.actor, delete: step.edit.path };
    default:
      return null;
  }
}

type LevelRun = { level: Level; scenario: Scenario; solutionStart: number };

function toScenario(level: Level): LevelRun {
  const solution = solutions[level.id];
  if (!solution) throw new Error(`level ${level.id} has no documented solution`);
  const convert = (steps: ScriptStep[]) => steps.map(toScenarioStep).filter((s): s is ScenarioStep => s !== null);
  const before = [...convert(level.setup), ...convert(level.intro)];
  return {
    level,
    scenario: { name: `level ${level.id}`, steps: [...before, ...convert(solution)], copiesCommits: true },
    solutionStart: before.length,
  };
}

const runs = levels.map(toScenario);
const real = new Map<string, RealGitResult | Error>();

beforeAll(async () => {
  const queue = [...runs];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      try {
        real.set(r.level.id, await runRealGit(r.scenario));
      } catch (e) {
        real.set(r.level.id, e as Error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(2, Math.min(8, availableParallelism())) }, worker));
}, 120_000);

function realResult(id: string): RealGitResult {
  const r = real.get(id);
  if (!r) throw new Error(`no real git result for level ${id}`);
  if (r instanceof Error) throw r;
  return r;
}

describe("levels in real git", () => {
  it("every level has a documented solution", () => {
    expect(levels.filter((l) => !solutions[l.id]).map((l) => l.id)).toEqual([]);
  });

  it.for(runs.map((r) => [r.level.id, r] as const))("%s: every solution step succeeds in real git", ([id, run]) => {
    const failed = realResult(id)
      .records.slice(run.solutionStart)
      .filter((rec) => rec.outcome === "error")
      .map((rec) => `${JSON.stringify(rec.step)}\n${rec.output}`);
    expect(failed).toEqual([]);
  });

  it.for(runs.map((r) => [r.level.id, r] as const))("%s: the engine ends in the same state as real git", ([id, run]) => {
    const engineRun = runEngine(engine, run.scenario);
    if (engineRun.kind === "unsupported") expect.fail(`level ${id} uses something the engine does not support: ${engineRun.reason}`);
    const realRun = realResult(id);
    const problems = [...diffOutcomes(realRun.records, engineRun.steps), ...diffSnapshots(realRun.snapshot, fromEngine(engineRun.state))];
    if (problems.length > 0) expect.fail(formatDiff(`level ${id}`, problems));
  });
});
