import { describe, expect, it } from "vitest";
import { engine, queries } from "@/engine";
import type { OutputLine, RepoState, ScriptStep } from "@/engine/types";
import { getLevel, levels } from "./index";
import { git, write } from "./script";
import { solutions } from "./solutions";

/** Output that must never appear while a level runs: a crash inside the engine, or a missing feature. */
const UNSUPPORTED = /not (yet )?(supported|implemented)/i;
const INTERNAL_ERROR = /internal engine error/i;

function describeStep(step: ScriptStep): string {
  if (step.kind === "git") return `${step.actor}$ ${step.argv.join(" ")}`;
  if (step.kind === "edit") return `${step.edit.actor} edits ${step.edit.path}`;
  return step.kind;
}

function badLines(output: OutputLine[]): string[] {
  return output.map((l) => l.text).filter((t) => INTERNAL_ERROR.test(t) || UNSUPPORTED.test(t));
}

/**
 * Run the git and edit steps in order (say, mood and pause are presentation only) and return the
 * final state. Fails the test on the first refused step, on a throw, and on any output line that
 * reports an internal engine error or a missing feature, even from an accepted step.
 */
function runSteps(start: RepoState, steps: ScriptStep[]): RepoState {
  let state = start;
  for (const step of steps) {
    if (step.kind !== "git" && step.kind !== "edit") continue;
    const result =
      step.kind === "git" ? engine.run(state, { actor: step.actor, argv: step.argv }) : engine.edit(state, step.edit);
    const text = result.output.map((l) => l.text).join("\n");
    expect(badLines(result.output), describeStep(step)).toEqual([]);
    expect(result.ok, `${describeStep(step)} failed: ${text}`).toBe(true);
    state = result.state;
  }
  return state;
}

function goalsFailing(id: string, state: RepoState): string[] {
  return getLevel(id)!.goals.filter((g) => !g.check(state, queries)).map((g) => g.id);
}

// ---------------------------------------------------------------------------
// Level data.
// ---------------------------------------------------------------------------

describe("level data", () => {
  it("has unique ids and is sorted by act and order", () => {
    const ids = levels.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = levels.map((l) => l.act * 1000 + l.order);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  it("finds levels by id", () => {
    expect(getLevel("act2-01")?.title).toBe("Blaze was in a hurry");
    expect(getLevel("nope")).toBeUndefined();
  });

  it.each(levels.map((l) => [l.id, l] as const))("%s is complete", (id, level) => {
    expect(level.goals.length).toBeGreaterThan(0);
    expect(new Set(level.goals.map((g) => g.id)).size).toBe(level.goals.length);
    expect(level.suggestions.length).toBeGreaterThan(0);
    expect(level.intro.length).toBeGreaterThan(0);
    expect(level.outro.length).toBeGreaterThan(0);
    expect(solutions[id]?.length).toBeGreaterThan(0);
    for (const step of solutions[id]) {
      if (step.kind === "git") expect(step.actor).toBe("player");
    }
    // Every robot that speaks is listed in the crew.
    for (const step of [...level.intro, ...level.outro]) {
      if (step.kind === "say" || step.kind === "mood" || step.kind === "point") expect(level.crew).toContain(step.actor);
    }
    // Suggestion buttons show the exact command, so each one is a git command.
    for (const s of level.suggestions) expect(s.startsWith("git ")).toBe(true);
  });

  it.each(levels.map((l) => [l.id, l] as const))("%s has a mission card and a short opening scene", (_, level) => {
    expect(level.mission?.situation.length).toBeGreaterThan(0);
    expect(level.mission?.job.length).toBeGreaterThan(0);
    expect(level.mission?.practise.length).toBeGreaterThan(0);
    // Short scenes: the story sets the job up, the job bar carries the instructions.
    expect(level.intro.filter((s) => s.kind === "say").length).toBeLessThanOrEqual(5);
    // A screen tour adds lines, but the whole opening still reads in under a minute.
    expect(level.intro.filter((s) => s.kind === "say" || s.kind === "point").length).toBeLessThanOrEqual(8);
  });

  it.each(levels.map((l) => [l.id, l] as const))("%s: every file a robot line points at is in the player's files", (_, level) => {
    let state = runSteps(engine.createRepo(), level.setup);
    for (const step of level.intro) {
      if (step.kind === "say") {
        for (const path of step.files ?? []) {
          expect(Object.hasOwn(state.worktrees.player.workingTree, path), `${step.actor}: "${step.text}" -> ${path}`).toBe(true);
        }
      } else {
        state = runSteps(state, [step]);
      }
    }
  });

  it.each(levels.map((l) => [l.id, l] as const))("%s: every map pointer has something to highlight", (id, level) => {
    // The state each scene's point steps see: intro points after setup (and earlier intro steps),
    // outro points after the documented solution.
    const check = (state: RepoState, step: ScriptStep) => {
      if (step.kind !== "point" || step.target !== "map" || !step.focus) return;
      const what = `${step.actor}: "${step.text}"`;
      const messages = Object.values(state.commits).map((c) => c.message);
      if (step.focus.commits) expect(step.focus.commits.some((m) => messages.includes(m)), what).toBe(true);
      if (step.focus.branches) {
        // A branch the player names may be called something else; the map then lights every branch line.
        const names = Object.keys(state.branches);
        expect(step.focus.branches.some((b) => names.includes(b)) || names.some((n) => n !== "main"), what).toBe(true);
      }
      if (step.focus.lost) expect(queries.lost(state).length, what).toBeGreaterThan(0);
    };
    let state = runSteps(engine.createRepo(), level.setup);
    for (const step of level.intro) {
      check(state, step);
      state = runSteps(state, [step]);
    }
    state = runSteps(state, solutions[id]);
    for (const step of level.outro) {
      check(state, step);
      state = runSteps(state, [step]);
    }
  });

  it("has exactly one documented solution per level", () => {
    expect(Object.keys(solutions).sort()).toEqual(levels.map((l) => l.id).sort());
  });
});

// ---------------------------------------------------------------------------
// Levels through the engine.
// ---------------------------------------------------------------------------

describe("levels through the engine", () => {
  for (const level of levels) {
    describe(level.id, () => {
      it("setup runs without errors", () => {
        runSteps(engine.createRepo(), level.setup);
      });

      it("goals are not met after setup and intro", () => {
        const state = runSteps(engine.createRepo(), [...level.setup, ...level.intro]);
        expect(level.goals.map((g) => g.check(state, queries)).every(Boolean)).toBe(false);
      });

      it("the documented solution meets every goal", () => {
        const state = runSteps(engine.createRepo(), [...level.setup, ...level.intro, ...solutions[level.id]]);
        expect(goalsFailing(level.id, state)).toEqual([]);
      });

      it("every suggestion is a command the engine knows", () => {
        const state = runSteps(engine.createRepo(), [...level.setup, ...level.intro]);
        for (const line of level.suggestions) {
          const result = engine.run(state, { actor: "player", argv: engine.parseCommandLine(line) });
          expect(badLines(result.output), line).toEqual([]);
        }
      });
    });
  }

  it("act2-01: Tidy's commits are lost after the intro and found again after the fix", () => {
    const level = getLevel("act2-01")!;
    const state = runSteps(engine.createRepo(), [...level.setup, ...level.intro]);
    const lostMessages = queries
      .lost(state)
      .map((oid) => state.commits[oid].message)
      .sort();
    expect(lostMessages).toEqual(["Add iced tea to the prices", "Add the price list"]);
    // The player's reflog still knows where main was.
    const previous = queries.resolve(state, "player", "main@{1}");
    expect(previous && state.commits[previous].message).toBe("Add iced tea to the prices");
  });

  // -------------------------------------------------------------------------
  // Act 2, levels 2 to 5: other fair solutions pass, shortcuts that lose or rewrite work fail.
  // -------------------------------------------------------------------------

  /** Run setup, intro and the given steps; every step must succeed. Returns the ids of goals that fail. */
  function failedGoals(id: string, steps: ScriptStep[]): string[] {
    const level = getLevel(id)!;
    return goalsFailing(id, runSteps(engine.createRepo(), [...level.setup, ...level.intro, ...steps]));
  }

  it("act1-04: after Tidy's push the player is behind origin/main by one commit", () => {
    const level = getLevel("act1-04")!;
    const state = runSteps(engine.createRepo(), [...level.setup, ...level.intro]);
    const status = engine.run(state, { actor: "player", argv: ["git", "status"] }).output.map((l) => l.text);
    expect(status).toContain("Your branch is behind 'origin/main' by 1 commit, and can be fast-forwarded.");
  });

  it("act1-04: a push before pulling is rejected, and pull then push wins", () => {
    const level = getLevel("act1-04")!;
    let state = runSteps(engine.createRepo(), [
      ...level.setup,
      ...level.intro,
      git("player", "add", "sign.txt"),
      git("player", "commit", "-m", "Announce Saturdays on the sign"),
    ]);
    const push = engine.run(state, { actor: "player", argv: ["git", "push"] });
    expect(push.ok).toBe(false);
    expect(push.output.map((l) => l.text).join("\n")).toContain("(non-fast-forward)");
    state = runSteps(state, [git("player", "pull"), git("player", "push")]);
    expect(goalsFailing("act1-04", state)).toEqual([]);
  });

  it("act1-04: pull --rebase after committing also wins", () => {
    const failed = failedGoals("act1-04", [
      git("player", "commit", "-am", "Announce Saturdays on the sign"),
      git("player", "pull", "--rebase"),
      git("player", "push"),
    ]);
    expect(failed).toEqual([]);
  });

  it("act1-04: force-pushing over Tidy's commit does not win", () => {
    const failed = failedGoals("act1-04", [
      git("player", "commit", "-am", "Announce Saturdays on the sign"),
      git("player", "push", "--force"),
    ]);
    expect(failed).toEqual(["pulled", "pushed"]);
  });

  it("act2-02: the merge stops on a conflict in sign.txt only", () => {
    const level = getLevel("act2-02")!;
    const state = runSteps(engine.createRepo(), [...level.setup, ...level.intro, git("player", "merge", "drift")]);
    expect(Object.keys(state.worktrees.player.conflicts)).toEqual(["sign.txt"]);
    expect(state.worktrees.player.workingTree["sign.txt"]).toContain("<<<<<<< HEAD");
  });

  it("act2-02: rebasing a copy of Drift's branch also wins, with the lines in either order", () => {
    const failed = failedGoals("act2-02", [
      git("player", "switch", "-c", "drift-fresh", "drift"),
      git("player", "rebase", "main"),
      write("player", "sign.txt", "LEMONADE\nOpen 9 to 5\nEvery cup comes with a cloud\nNow with iced tea\n"),
      git("player", "add", "sign.txt"),
      git("player", "rebase", "--continue"),
      git("player", "switch", "main"),
      git("player", "merge", "drift-fresh"),
      git("player", "push"),
    ]);
    expect(failed).toEqual([]);
  });

  it("act2-02: keeping only main's side of the conflict does not win", () => {
    const failed = failedGoals("act2-02", [
      git("player", "merge", "drift"),
      write("player", "sign.txt", "LEMONADE\nOpen 9 to 5\nNow with iced tea\n"),
      git("player", "add", "sign.txt"),
      git("player", "commit"),
      git("player", "push"),
    ]);
    expect(failed).toEqual(["both-lines"]);
  });

  it("act2-02: committing the conflict markers does not win", () => {
    const failed = failedGoals("act2-02", [
      git("player", "merge", "drift"),
      git("player", "add", "sign.txt"),
      git("player", "commit"),
      git("player", "push"),
    ]);
    expect(failed).toEqual(["both-lines"]);
  });

  it("act2-03: popping the recipe onto main also wins", () => {
    const failed = failedGoals("act2-03", [
      git("player", "stash", "pop", "stash@{1}"),
      git("player", "add", "menu.txt"),
      git("player", "commit", "-m", "Save the fizz recipe"),
    ]);
    expect(failed).toEqual([]);
  });

  it("act2-03: a plain stash pop restores the doodles, not the recipe", () => {
    const failed = failedGoals("act2-03", [
      git("player", "stash", "pop"),
      git("player", "commit", "-am", "Save whatever was in the stash"),
    ]);
    expect(failed).toContain("recipe-committed");
  });

  it("act2-03: clearing the stash throws the work away", () => {
    const failed = failedGoals("act2-03", [git("player", "stash", "clear")]);
    expect(failed).toEqual(["recipe-committed", "doodles-safe"]);
  });

  it("act2-04: reverting by commit id also wins", () => {
    const level = getLevel("act2-04")!;
    const state = runSteps(engine.createRepo(), [...level.setup, ...level.intro]);
    const blaze = Object.values(state.commits).find((c) => c.message === "Make everything FREE")!;
    const failed = failedGoals("act2-04", [
      git("player", "pull"),
      git("player", "revert", blaze.oid.slice(0, 7)),
      git("player", "push"),
    ]);
    expect(failed).toEqual([]);
  });

  it("act2-04: reset --hard and force-push rewrites history and does not win", () => {
    const failed = failedGoals("act2-04", [
      git("player", "pull"),
      git("player", "reset", "--hard", "HEAD~2"),
      git("player", "push", "--force"),
    ]);
    expect(failed).toEqual(["history-kept", "tip-jar-kept"]);
  });

  it("act2-05: merging Drift's whole branch does not win", () => {
    const failed = failedGoals("act2-05", [git("player", "merge", "drift"), git("player", "push")]);
    expect(failed).toEqual(["only-the-fix"]);
  });
});
