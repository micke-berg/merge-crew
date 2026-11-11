import { describe, expect, it } from "vitest";
import type { Goal } from "@/engine/types";
import { everyLevel as levels } from "@/levels";
import { begin, skipScript, startLevel } from "./game";
import { readJob } from "./jobSteps";

const goal = (id: string): Goal => ({ id, description: id, check: () => true });
const goals = [goal("fix"), goal("keep"), goal("push")];

describe("readJob", () => {
  it("shows a goal met at the start as a rule, not as a finished step", () => {
    const job = readJob(goals, [false, true, false], [false, true, false]);
    expect(job.steps.map((l) => l.goal.id)).toEqual(["fix", "push"]);
    expect(job.rules.map((l) => l.goal.id)).toEqual(["keep"]);
    expect(job.steps.every((l) => !l.done)).toBe(true);
    expect(job.current?.id).toBe("fix");
  });

  it("moves on through the steps and leaves a kept rule alone", () => {
    expect(readJob(goals, [true, true, false], [false, true, false]).current?.id).toBe("push");
    expect(readJob(goals, [true, true, true], [false, true, false]).current).toBeNull();
  });

  it("points at a broken rule once every step is done, and at the step before that", () => {
    const broken = readJob(goals, [true, false, true], [false, true, false]);
    expect(broken.rules[0].done).toBe(false);
    expect(broken.current?.id).toBe("keep");
    expect(readJob(goals, [false, false, true], [false, true, false]).current?.id).toBe("fix");
  });

  it("treats every goal as a step when nothing was met at the start", () => {
    const job = readJob(goals, [true, false, false], [false, false, false]);
    expect(job.rules).toEqual([]);
    expect(job.steps.map((l) => l.done)).toEqual([true, false, false]);
  });
});

describe("every level's job", () => {
  it.each(levels.map((l) => [l.id, l] as const))("%s starts with a step to do and no step ticked", (_, level) => {
    const game = skipScript(begin(startLevel(level)));
    expect(game.phase).toBe("play");
    const job = readJob(level.goals, game.goals, game.kept);
    expect(job.steps.length).toBeGreaterThan(0);
    expect(job.steps.some((l) => l.done)).toBe(false);
    expect(job.rules.every((l) => l.done)).toBe(true);
  });
});
