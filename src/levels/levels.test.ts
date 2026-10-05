import { describe, expect, it } from "vitest";
import type { Engine, Queries, RepoState, ScriptStep } from "@/engine/types";
import { getLevel, levels, solutions } from "./index";
import { git, write } from "./script";

// ---------------------------------------------------------------------------
// Engine probe. The engine lands in parallel with these levels, so it is loaded dynamically:
// while "@/engine" does not exist yet, the engine tests are skipped instead of failing the suite.
// Once the engine has landed, this can become a plain `import { engine, queries } from "@/engine"`.
// ---------------------------------------------------------------------------

type EngineModule = { engine: Engine; queries: Queries };

async function loadEngine(): Promise<{ mod: EngineModule | null; reason: string }> {
  const specifier = "@/engine";
  try {
    const mod = (await import(/* @vite-ignore */ specifier)) as Partial<EngineModule>;
    if (!mod.engine || !mod.queries) {
      return { mod: null, reason: "@/engine does not export { engine, queries } yet" };
    }
    return { mod: mod as EngineModule, reason: "" };
  } catch (error) {
    return { mod: null, reason: `@/engine could not be loaded yet (${(error as Error).message.split("\n")[0]})` };
  }
}

const probe = await loadEngine();

const UNSUPPORTED = /not (yet )?(supported|implemented)/i;

type RunResult = {
  state: RepoState;
  /** Steps that failed for a reason other than a missing engine feature. */
  failures: string[];
  /** Set when the engine reported a command or option as not supported. */
  unsupported: string | null;
};

function describeStep(step: ScriptStep): string {
  if (step.kind === "git") return `${step.actor}$ ${step.argv.join(" ")}`;
  if (step.kind === "edit") return `${step.edit.actor} edits ${step.edit.path}`;
  return step.kind;
}

function runSteps(mod: EngineModule, start: RepoState, steps: ScriptStep[]): RunResult {
  let state = start;
  const failures: string[] = [];
  for (const step of steps) {
    if (step.kind !== "git" && step.kind !== "edit") continue; // say, mood, pause: presentation only
    let result;
    try {
      result =
        step.kind === "git"
          ? mod.engine.run(state, { actor: step.actor, argv: step.argv })
          : mod.engine.edit(state, step.edit);
    } catch (error) {
      const message = (error as Error).message;
      if (UNSUPPORTED.test(message)) return { state, failures, unsupported: `${describeStep(step)}: ${message}` };
      failures.push(`${describeStep(step)} threw: ${message}`);
      return { state, failures, unsupported: null };
    }
    const text = result.output.map((l) => l.text).join("\n");
    if (!result.ok && UNSUPPORTED.test(text)) {
      return { state, failures, unsupported: `${describeStep(step)}: ${text}` };
    }
    if (!result.ok) {
      failures.push(`${describeStep(step)} failed: ${text}`);
      return { state, failures, unsupported: null };
    }
    state = result.state;
  }
  return { state, failures, unsupported: null };
}

// ---------------------------------------------------------------------------
// Level data: runs without the engine.
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
    expect(level.hintContext.length).toBeGreaterThan(0);
    expect(level.suggestions.length).toBeGreaterThan(0);
    expect(level.intro.length).toBeGreaterThan(0);
    expect(level.outro.length).toBeGreaterThan(0);
    expect(solutions[id]?.length).toBeGreaterThan(0);
    // Every robot that speaks is listed in the crew.
    for (const step of [...level.intro, ...level.outro]) {
      if (step.kind === "say" || step.kind === "mood") expect(level.crew).toContain(step.actor);
    }
    // Suggestion buttons show the exact command, so each one is a git command.
    for (const s of level.suggestions) expect(s.startsWith("git ")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Levels through the engine.
// ---------------------------------------------------------------------------

describe.skipIf(!probe.mod)(`levels through the engine${probe.mod ? "" : ` (skipped: ${probe.reason})`}`, () => {
  const mod = probe.mod as EngineModule;

  for (const level of levels) {
    describe(level.id, () => {
      it("setup runs without errors", (ctx) => {
        const r = runSteps(mod, mod.engine.createRepo(), level.setup);
        if (r.unsupported) ctx.skip(`engine gap: ${r.unsupported}`);
        expect(r.failures).toEqual([]);
      });

      it("goals are not met after setup and intro", (ctx) => {
        const r = runSteps(mod, mod.engine.createRepo(), [...level.setup, ...level.intro]);
        if (r.unsupported) ctx.skip(`engine gap: ${r.unsupported}`);
        expect(r.failures).toEqual([]);
        const passed = level.goals.map((g) => g.check(r.state, mod.queries));
        expect(passed.every(Boolean)).toBe(false);
      });

      it("the documented solution meets every goal", (ctx) => {
        const r = runSteps(mod, mod.engine.createRepo(), [...level.setup, ...level.intro, ...solutions[level.id]]);
        if (r.unsupported) ctx.skip(`engine gap: ${r.unsupported}`);
        expect(r.failures).toEqual([]);
        const failed = level.goals.filter((g) => !g.check(r.state, mod.queries)).map((g) => g.id);
        expect(failed).toEqual([]);
      });
    });
  }

  it("act2-01: Tidy's commits are lost after the intro and found again after the fix", (ctx) => {
    const level = getLevel("act2-01")!;
    const afterIntro = runSteps(mod, mod.engine.createRepo(), [...level.setup, ...level.intro]);
    if (afterIntro.unsupported) ctx.skip(`engine gap: ${afterIntro.unsupported}`);
    expect(afterIntro.failures).toEqual([]);
    const lostMessages = mod.queries
      .lost(afterIntro.state)
      .map((oid) => afterIntro.state.commits[oid].message)
      .sort();
    expect(lostMessages).toEqual(["Add iced tea to the prices", "Add the price list"]);
    // The player's reflog still knows where main was.
    const previous = mod.queries.resolve(afterIntro.state, "player", "main@{1}");
    expect(previous && afterIntro.state.commits[previous].message).toBe("Add iced tea to the prices");
  });

  // -------------------------------------------------------------------------
  // Act 2, levels 2 to 5: other fair solutions pass, shortcuts that lose or rewrite work fail.
  // -------------------------------------------------------------------------

  /** Run setup, intro and the given steps; every step must succeed. Returns the ids of goals that fail. */
  function failedGoals(ctx: { skip: (note?: string) => never }, id: string, steps: ScriptStep[]): string[] {
    const level = getLevel(id)!;
    const r = runSteps(mod, mod.engine.createRepo(), [...level.setup, ...level.intro, ...steps]);
    if (r.unsupported) ctx.skip(`engine gap: ${r.unsupported}`);
    expect(r.failures).toEqual([]);
    return level.goals.filter((g) => !g.check(r.state, mod.queries)).map((g) => g.id);
  }

  it.each(levels.map((l) => [l.id, l] as const))(
    "%s: every suggestion is a command the engine knows",
    (_id, level) => {
      const r = runSteps(mod, mod.engine.createRepo(), [...level.setup, ...level.intro]);
      expect(r.failures).toEqual([]);
      for (const line of level.suggestions) {
        const result = mod.engine.run(r.state, { actor: "player", argv: mod.engine.parseCommandLine(line) });
        expect(result.output.map((l) => l.text).join("\n"), line).not.toMatch(UNSUPPORTED);
      }
    },
  );

  it("act2-02: the merge stops on a conflict in sign.txt only", (ctx) => {
    const level = getLevel("act2-02")!;
    const r = runSteps(mod, mod.engine.createRepo(), [...level.setup, ...level.intro, git("player", "merge", "drift")]);
    if (r.unsupported) ctx.skip(`engine gap: ${r.unsupported}`);
    expect(r.failures).toEqual([]);
    expect(Object.keys(r.state.worktrees.player.conflicts)).toEqual(["sign.txt"]);
    expect(r.state.worktrees.player.workingTree["sign.txt"]).toContain("<<<<<<< HEAD");
  });

  it("act2-02: rebasing a copy of Drift's branch also wins, with the lines in either order", (ctx) => {
    const failed = failedGoals(ctx, "act2-02", [
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

  it("act2-02: keeping only main's side of the conflict does not win", (ctx) => {
    const failed = failedGoals(ctx, "act2-02", [
      git("player", "merge", "drift"),
      write("player", "sign.txt", "LEMONADE\nOpen 9 to 5\nNow with iced tea\n"),
      git("player", "add", "sign.txt"),
      git("player", "commit"),
      git("player", "push"),
    ]);
    expect(failed).toEqual(["both-lines"]);
  });

  it("act2-02: committing the conflict markers does not win", (ctx) => {
    const failed = failedGoals(ctx, "act2-02", [
      git("player", "merge", "drift"),
      git("player", "add", "sign.txt"),
      git("player", "commit"),
      git("player", "push"),
    ]);
    expect(failed).toEqual(["both-lines"]);
  });

  it("act2-03: popping the recipe onto main also wins", (ctx) => {
    const failed = failedGoals(ctx, "act2-03", [
      git("player", "stash", "pop", "stash@{1}"),
      git("player", "add", "menu.txt"),
      git("player", "commit", "-m", "Save the fizz recipe"),
    ]);
    expect(failed).toEqual([]);
  });

  it("act2-03: a plain stash pop restores the doodles, not the recipe", (ctx) => {
    const failed = failedGoals(ctx, "act2-03", [
      git("player", "stash", "pop"),
      git("player", "commit", "-am", "Save whatever was in the stash"),
    ]);
    expect(failed).toContain("recipe-committed");
  });

  it("act2-03: clearing the stash throws the work away", (ctx) => {
    const failed = failedGoals(ctx, "act2-03", [git("player", "stash", "clear")]);
    expect(failed).toEqual(["recipe-committed", "doodles-safe"]);
  });

  it("act2-04: reverting by commit id also wins", (ctx) => {
    const level = getLevel("act2-04")!;
    const r = runSteps(mod, mod.engine.createRepo(), [...level.setup, ...level.intro]);
    if (r.unsupported) ctx.skip(`engine gap: ${r.unsupported}`);
    const blaze = Object.values(r.state.commits).find((c) => c.message === "Make everything FREE")!;
    const failed = failedGoals(ctx, "act2-04", [
      git("player", "pull"),
      git("player", "revert", blaze.oid.slice(0, 7)),
      git("player", "push"),
    ]);
    expect(failed).toEqual([]);
  });

  it("act2-04: reset --hard and force-push rewrites history and does not win", (ctx) => {
    const failed = failedGoals(ctx, "act2-04", [
      git("player", "pull"),
      git("player", "reset", "--hard", "HEAD~2"),
      git("player", "push", "--force"),
    ]);
    expect(failed).toEqual(["history-kept", "tip-jar-kept"]);
  });

  it("act2-05: merging Drift's whole branch does not win", (ctx) => {
    const failed = failedGoals(ctx, "act2-05", [git("player", "merge", "drift"), git("player", "push")]);
    expect(failed).toEqual(["only-the-fix"]);
  });
});
