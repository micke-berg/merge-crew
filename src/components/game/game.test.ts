import { describe, expect, it } from "vitest";
import { engine } from "@/engine";
import { levels, solutions } from "@/levels";
import { advance, advanceUntilClick, begin, runPlayerCommand, skipScript, startLevel, type GameState } from "./game";

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
  });
});
