import { describe, expect, it } from "vitest";
import { begin, editPlayerFile, runPlayerCommand, startLevel } from "@/components/game/game";
import { everyLevel } from "./index";
import { sandbox, validFileName } from "./sandbox";

describe("the sandbox", () => {
  it("is in no level list", () => {
    expect(everyLevel.map((l) => l.id)).not.toContain(sandbox.id);
  });

  it("starts on the player's turn and can never be won", () => {
    let game = begin(startLevel(sandbox));
    expect(game.phase).toBe("play");
    for (const line of ["git add notes.txt", 'git commit -m "First save"', "git switch -c idea", "git push -u origin main", "git status"]) {
      const out = runPlayerCommand(game, line);
      expect(out.ok, line).toBe(true);
      expect(out.won).toBe(false);
      game = out.state;
    }
    expect(game.phase).toBe("play");
  });

  it("lets the player write a new file and edit it", () => {
    let game = begin(startLevel(sandbox));
    game = editPlayerFile(game, "menu.txt", "Lemonade\n").state;
    game = editPlayerFile(game, "menu.txt", "Lemonade\nSoup\n").state;
    expect(game.repo.worktrees.player.workingTree["menu.txt"]).toBe("Lemonade\nSoup\n");
    expect(game.phase).toBe("play");
  });

  it("has suggestion buttons that all run", () => {
    let game = begin(startLevel(sandbox));
    for (const line of sandbox.suggestions) {
      const out = runPlayerCommand(game, line);
      expect(out.ok, line).toBe(true);
      game = out.state;
    }
  });
});

describe("validFileName", () => {
  it.each(["notes.txt", "menu/tea.txt", "a", "README", "my-file_2.md"])("accepts %s", (name) => {
    expect(validFileName(name)).toBe(true);
  });

  it.each(["", " ", "a b.txt", "../x", "/abs", "x/", ".git/config", "a//b", "-flag", ".hidden", "x".repeat(41), "weird\"name", "a;b"])("refuses %s", (name) => {
    expect(validFileName(name)).toBe(false);
  });
});
