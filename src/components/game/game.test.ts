import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { engine } from "@/engine";
import type { Level } from "@/engine/types";
import { levels } from "@/levels";
import { git, say, write } from "@/levels/script";
import { solutions } from "@/levels/solutions";
import {
  advance,
  advanceUntilClick,
  begin,
  checkGoals,
  editPlayerFile,
  runPlayerCommand,
  skipScript,
  startLevel,
  type GameState,
} from "./game";

// checkGoals logs a goal that throws instead of crashing the game. In tests that log is a failure.
let consoleError: MockInstance<typeof console.error>;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error");
});
afterEach(() => {
  const calls = consoleError.mock.calls;
  consoleError.mockRestore();
  expect(calls, "console.error was called").toEqual([]);
});

/** Play a scene to its end the way an impatient player clicks through it. */
function clickThrough(s: GameState): GameState {
  let state = s;
  for (let i = 0; i < 500 && (state.phase === "intro" || state.phase === "outro"); i++) state = advance(state).state;
  return state;
}

/** Turn a documented solution step back into what a player would type. */
function typed(argv: string[]): string {
  return argv.map((w) => (/[\s"'\\]/.test(w) ? `"${w.replace(/(["\\])/g, "\\$1")}"` : w)).join(" ");
}

describe.each(levels.map((l) => [l.id, l] as const))("level %s", (id, level) => {
  it("sets up, plays the intro and is won by the documented solution", () => {
    let s = startLevel(level);
    expect(s.phase).toBe("brief");
    s = clickThrough(begin(s));
    expect(s.phase).toBe("play");
    expect(s.log.some((l) => l.kind === "error")).toBe(false);
    expect(s.goals.every(Boolean)).toBe(false);

    const solution = solutions[id];
    expect(solution.length).toBeGreaterThan(0);
    for (const step of solution) {
      if (step.kind === "git") {
        expect(step.actor).toBe("player");
        const out = runPlayerCommand(s, typed(step.argv));
        expect(out.ok, out.state.log.at(-1)?.text).toBe(true);
        s = out.state;
      } else if (step.kind === "edit" && step.edit.kind === "write" && step.edit.actor === "player") {
        // The player's own file edits go through the conflict editor's action.
        s = editPlayerFile(s, step.edit.path, step.edit.content).state;
      } else if (step.kind === "edit") {
        s = { ...s, repo: engine.edit(s.repo, step.edit).state };
      }
    }
    expect(s.goals.every(Boolean)).toBe(true);
    expect(s.phase === "outro" || s.phase === "won").toBe(true);
    s = clickThrough(s);
    expect(s.phase).toBe("won");
  });

  it("can skip the intro and still be won", () => {
    let s = skipScript(begin(startLevel(level)));
    expect(s.phase).toBe("play");
    for (const step of solutions[id]) {
      if (step.kind === "git") s = runPlayerCommand(s, typed(step.argv)).state;
      else if (step.kind === "edit" && step.edit.kind === "write" && step.edit.actor === "player") {
        s = editPlayerFile(s, step.edit.path, step.edit.content).state;
      } else if (step.kind === "edit") s = { ...s, repo: engine.edit(s.repo, step.edit).state };
    }
    expect(skipScript(s).phase).toBe("won");
  });
});

describe("player commands", () => {
  const level = levels.find((l) => l.id === "act2-01")!;
  const playing = () => skipScript(begin(startLevel(level)));

  it("echoes the command and its output", () => {
    const s = runPlayerCommand(playing(), "git reflog").state;
    const lines = s.log.slice(-3);
    expect(s.log.some((l) => l.kind === "command" && l.text === "git reflog")).toBe(true);
    expect(lines.some((l) => l.kind === "out" && l.text.includes("HEAD@{1}"))).toBe(true);
  });

  it("keeps the state on a refused command and logs an error", () => {
    const before = playing();
    const out = runPlayerCommand(before, "git frobnicate");
    expect(out.ok).toBe(false);
    expect(out.state.repo).toBe(before.repo);
    expect(out.state.log.at(-1)?.kind).toBe("error");
  });

  it("clears the terminal on clear without running anything", () => {
    const s = runPlayerCommand(runPlayerCommand(playing(), "git status").state, "clear").state;
    expect(s.log).toEqual([]);
  });

  it("ignores commands outside the player turn", () => {
    const brief = startLevel(level);
    expect(runPlayerCommand(brief, "git status").state).toBe(brief);
  });

  it("stops at each spoken line while playing the intro", () => {
    const s = advanceUntilClick(begin(startLevel(level)));
    expect(s.phase).toBe("intro");
    expect(s.bubble?.actor).toBe("blaze");
    // The line names the file it talks about, for the files panel to highlight.
    expect(s.bubble?.files).toEqual(["sign.txt"]);
  });
});

/** A small level built for these tests: one file, one commit, a goal the test controls. */
function testLevel(check: Level["goals"][number]["check"]): Level {
  return {
    id: "test-01",
    act: 1,
    order: 1,
    title: "Test level",
    brief: "A level for tests.",
    crew: ["tidy"],
    setup: [write("player", "a.txt", "one\n"), git("player", "add", "a.txt"), git("player", "commit", "-m", "First")],
    intro: [say("tidy", "Go on.")],
    goals: [{ id: "flag", description: "The test says so", check }],
    hintContext: "Test only.",
    suggestions: ["git status"],
    outro: [say("tidy", "Done.")],
  };
}

describe("goal checks", () => {
  it("re-checks goals after an accepted command that leaves the repository as it was", () => {
    let met = false;
    const s = skipScript(begin(startLevel(testLevel(() => met))));
    expect(s.phase).toBe("play");
    expect(s.goals).toEqual([false]);
    met = true;
    const out = runPlayerCommand(s, "git status");
    expect(out.changed).toBe(false);
    expect(out.state.goals).toEqual([true]);
    expect(out.won).toBe(true);
    expect(out.state.phase).toBe("outro");
  });

  it("keeps the goals as they were after a refused command", () => {
    let met = false;
    const s = skipScript(begin(startLevel(testLevel(() => met))));
    met = true;
    const out = runPlayerCommand(s, "git frobnicate");
    expect(out.ok).toBe(false);
    expect(out.state.goals).toEqual([false]);
    expect(out.won).toBe(false);
  });

  it("re-checks goals after the player saves a file, even with the same content", () => {
    let met = false;
    const s = skipScript(begin(startLevel(testLevel(() => met))));
    met = true;
    const out = editPlayerFile(s, "a.txt", "one\n");
    expect(out.ok).toBe(true);
    expect(out.state.goals).toEqual([true]);
    expect(out.won).toBe(true);
  });

  it("treats a goal that throws as not met and logs it", () => {
    consoleError.mockImplementation(() => {});
    const level = testLevel(() => {
      throw new Error("broken goal");
    });
    expect(checkGoals(level, startLevel(level).repo)).toEqual([false]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toContain('Goal "flag" of level test-01');
    consoleError.mockClear();
  });
});

describe("command line errors", () => {
  it("refuses a command with an unclosed quote without running it", () => {
    const level = levels[0];
    let s = skipScript(begin(startLevel(level)));
    const before = s.repo;
    const out = runPlayerCommand(s, 'git commit -m "half a message');
    s = out.state;
    expect(out.ok).toBe(false);
    expect(s.repo).toBe(before);
    expect(s.log.at(-1)?.kind).toBe("error");
    expect(s.log.at(-1)?.text).toMatch(/unclosed double quote/);
  });
});
