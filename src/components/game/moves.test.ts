import { describe, expect, it } from "vitest";
import engine from "@/engine";
import { levels } from "@/levels";
import { solutions } from "@/levels/solutions";
import { begin, runPlayerCommand, skipScript, startLevel } from "./game";
import { againstPar, countsAsMove } from "./moves";

const argv = (line: string) => engine.parseCommandLine(line);

describe("countsAsMove", () => {
  it.each([
    "git status", "git log --oneline --all", "git diff HEAD~2 HEAD", "git show HEAD~1", "git reflog", "git blame prices.txt",
    "git stash list", "git stash show -p stash@{1}", "git branch", "git branch -a", "git worktree list", "git help", "git",
    "ls", "cat sign.txt", "help", "clear",
  ])("%s is free", (line) => {
    expect(countsAsMove(argv(line))).toBe(false);
  });

  it.each([
    "git add sign.txt", "git commit -m x", "git branch rescue main@{1}", "git branch -d fizz", "git stash", "git stash pop",
    "git stash branch fizz stash@{1}", "git switch main", "git merge tidy", "git push", "git pull", "git fetch", "git reset --hard HEAD~1",
    "git restore sign.txt", "git worktree add /crew/x",
  ])("%s counts", (line) => {
    expect(countsAsMove(argv(line))).toBe(true);
  });
});

describe("againstPar", () => {
  it("compares a move count with par", () => {
    expect([againstPar(2, 3), againstPar(3, 3), againstPar(5, 3)]).toEqual(["under", "on", "over"]);
  });
});

describe("par and the recap line of every level", () => {
  it.each(levels.map((l) => [l.id, l] as const))("%s: par is the documented solution's move count", (id, level) => {
    const counted = solutions[id].filter((s) => s.kind === "git" && countsAsMove(s.argv)).length;
    // With rule cards the pick decides how much there is to fix, so there is no single par.
    expect(level.par).toBe(level.shift ? undefined : counted);
    expect(level.learned?.length ?? 0).toBeGreaterThan(20);
    expect(level.learned!.length).toBeLessThanOrEqual(140);
  });

  it.each(levels.map((l) => [l.id, l] as const))("%s: playing the documented solution lands exactly on par", (id, level) => {
    let game = skipScript(begin(startLevel(level)));
    for (const step of solutions[id]) {
      if (step.kind === "git") game = runPlayerCommand(game, step.argv.map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(" ")).state;
      else if (step.kind === "edit") game = { ...game, repo: engine.edit(game.repo, step.edit).state };
    }
    expect(game.phase === "outro" || game.phase === "won").toBe(true);
    if (!level.shift) expect(game.moves).toHaveLength(level.par!);
  });
});

describe("what the game counts", () => {
  const level = levels.find((l) => l.id === "act2-01")!;
  const play = (...lines: string[]) => lines.reduce((g, line) => runPlayerCommand(g, line).state, skipScript(begin(startLevel(level))));

  it("does not count looking, typos or refused commands", () => {
    const game = play("git status", "git stauts", "ls", "help", "git reflog", "git merge no-such-branch");
    expect(game.moves).toEqual([]);
    expect(game.commands).toBe(6);
  });

  it("keeps the commands that counted, in order", () => {
    expect(play("git reflog", "git branch tidy-rescue main@{1}", "git status", "git merge tidy-rescue").moves).toEqual([
      "git branch tidy-rescue main@{1}",
      "git merge tidy-rescue",
    ]);
  });
});
