import { describe, expect, it } from "vitest";
import { engine, queries } from "@/engine";
import type { Level } from "@/engine/types";
import {
  conflictHeadline,
  conflictRegions,
  conflictSource,
  finishCommand,
  hasConflictMarkers,
  parseConflicts,
  readyHeadline,
  resolveConflicts,
  sideLabels,
} from "./conflicts";
import { begin, editPlayerFile, runPlayerCommand, skipScript, startLevel, type GameState } from "./game";

const merge = [
  "title\n",
  "<<<<<<< HEAD\n",
  "color = red\n",
  "=======\n",
  "color = blue\n",
  ">>>>>>> feature\n",
  "end\n",
].join("");

describe("parseConflicts", () => {
  it("splits text and a region with its labels", () => {
    const segs = parseConflicts(merge);
    expect(segs.map((s) => s.kind)).toEqual(["text", "conflict", "text"]);
    const [r] = conflictRegions(segs);
    expect(r).toMatchObject({ index: 0, oursLabel: "HEAD", theirsLabel: "feature", ours: "color = red\n", theirs: "color = blue\n", base: null });
  });

  it("joins back to the original text when nothing is chosen", () => {
    expect(resolveConflicts(parseConflicts(merge), {})).toBe(merge);
  });

  it("reads the stash labels", () => {
    const text = "<<<<<<< Updated upstream\na\n=======\nb\n>>>>>>> Stashed changes\n";
    const [r] = conflictRegions(parseConflicts(text));
    expect([r.oursLabel, r.theirsLabel]).toEqual(["Updated upstream", "Stashed changes"]);
  });

  it("reads replayed-commit labels with spaces and parentheses", () => {
    const text = "<<<<<<< HEAD\na\n=======\nb\n>>>>>>> 1a2b3c4 (Add login: part 2)\n";
    expect(conflictRegions(parseConflicts(text))[0].theirsLabel).toBe("1a2b3c4 (Add login: part 2)");
  });

  it("handles markers without labels, empty sides and a missing final newline", () => {
    const text = "<<<<<<<\n=======\nonly theirs\n>>>>>>>";
    const [r] = conflictRegions(parseConflicts(text));
    expect(r).toMatchObject({ oursLabel: "", theirsLabel: "", ours: "", theirs: "only theirs\n" });
    expect(resolveConflicts(parseConflicts(text), {})).toBe(text);
  });

  it("reads a diff3 base section", () => {
    const text = "<<<<<<< HEAD\na\n||||||| base\norig\n=======\nb\n>>>>>>> x\n";
    expect(conflictRegions(parseConflicts(text))[0]).toMatchObject({ ours: "a\n", base: "orig\n", theirs: "b\n" });
  });

  it("finds several regions and numbers them", () => {
    const text = `${merge}middle\n${merge}`;
    expect(conflictRegions(parseConflicts(text)).map((r) => r.index)).toEqual([0, 1]);
  });

  it("keeps CRLF line endings", () => {
    const text = "x\r\n<<<<<<< HEAD\r\na\r\n=======\r\nb\r\n>>>>>>> f\r\ny\r\n";
    const segs = parseConflicts(text);
    expect(conflictRegions(segs)[0].ours).toBe("a\r\n");
    expect(resolveConflicts(segs, { 0: "theirs" })).toBe("x\r\nb\r\ny\r\n");
  });

  it("leaves incomplete or look-alike markers as plain text", () => {
    for (const text of [
      "a\n=======\nb\n",
      "<<<<<<< HEAD\nnever closed\n=======\n",
      "<<<<<<<< eight\n=======\n>>>>>>>> eight\n",
      "  <<<<<<< indented\n=======\n>>>>>>> x\n",
    ]) {
      expect(hasConflictMarkers(text)).toBe(false);
      expect(resolveConflicts(parseConflicts(text), {})).toBe(text);
    }
  });

  it("ignores a stray opener before a real region", () => {
    const text = "<<<<<<< stray\nx\n<<<<<<< HEAD\na\n=======\nb\n>>>>>>> f\n";
    const segs = parseConflicts(text);
    expect(segs[0]).toEqual({ kind: "text", text: "<<<<<<< stray\nx\n" });
    expect(conflictRegions(segs)).toHaveLength(1);
  });
});

describe("resolveConflicts", () => {
  const segs = parseConflicts(merge);
  it("keeps mine, theirs or both", () => {
    expect(resolveConflicts(segs, { 0: "ours" })).toBe("title\ncolor = red\nend\n");
    expect(resolveConflicts(segs, { 0: "theirs" })).toBe("title\ncolor = blue\nend\n");
    expect(resolveConflicts(segs, { 0: "both" })).toBe("title\ncolor = red\ncolor = blue\nend\n");
  });

  it("does not split on a marker inside a line", () => {
    const s = parseConflicts("<<<<<<< HEAD\na=======\nb\n>>>>>>> f\n");
    expect(conflictRegions(s)).toHaveLength(0);
  });

  it("resolves some regions and keeps the markers of the rest", () => {
    const two = parseConflicts(`${merge}${merge}`);
    const out = resolveConflicts(two, { 1: "theirs" });
    expect(out.startsWith(merge)).toBe(true);
    expect(hasConflictMarkers(out)).toBe(true);
    expect(resolveConflicts(two, { 0: "ours", 1: "theirs" })).toBe("title\ncolor = red\nend\ntitle\ncolor = blue\nend\n");
  });
});

describe("plain words", () => {
  it("says what stopped", () => {
    expect(conflictHeadline("merge", 1)).toBe("Merging stopped: 1 file has changes from both sides.");
    expect(conflictHeadline("rebase", 2)).toBe("Rebasing stopped: 2 files have changes from both sides.");
    expect(conflictHeadline("stash", 1)).toMatch(/^Applying the stash stopped/);
    expect(readyHeadline("cherry-pick")).toBe("Every conflict is fixed. Finish the cherry-pick with");
    expect(finishCommand("merge")).toBe("git commit");
    expect(finishCommand("stash")).toBe("");
  });

  it("names the sides, and swaps the meaning for a rebase", () => {
    expect(sideLabels("merge", "HEAD", "feature")).toEqual({ ours: "Your side (HEAD)", theirs: "Their side (feature)" });
    expect(sideLabels("rebase", "HEAD", "1a2b3c4 (Fix)").theirs).toBe("Your commit being replayed (1a2b3c4 (Fix))");
    expect(sideLabels("stash", "Updated upstream", "Stashed changes").theirs).toBe("Your stash (Stashed changes)");
  });
});

// A level with no story: two branches change the same line, and the player merges.
const sandbox: Level = {
  id: "test-conflict",
  act: 2,
  order: 99,
  title: "Test conflict",
  brief: "",
  crew: [],
  setup: [
    { kind: "edit", edit: { kind: "write", actor: "player", path: "app.txt", content: "title\ncolor = green\nend\n" } },
    { kind: "git", actor: "player", argv: ["git", "add", "app.txt"] },
    { kind: "git", actor: "player", argv: ["git", "commit", "-m", "Start"] },
    { kind: "git", actor: "player", argv: ["git", "switch", "-c", "feature"] },
    { kind: "edit", edit: { kind: "write", actor: "player", path: "app.txt", content: "title\ncolor = blue\nend\n" } },
    { kind: "git", actor: "player", argv: ["git", "commit", "-am", "Blue"] },
    { kind: "git", actor: "player", argv: ["git", "switch", "main"] },
    { kind: "edit", edit: { kind: "write", actor: "player", path: "app.txt", content: "title\ncolor = red\nend\n" } },
    { kind: "git", actor: "player", argv: ["git", "commit", "-am", "Red"] },
  ],
  intro: [],
  goals: [
    {
      id: "merged",
      description: "Merge feature into main with both colours",
      check: (state, q) => {
        const head = q.resolve(state, "player", "HEAD");
        const c = head ? state.commits[head] : null;
        return !!c && c.parents.length === 2 && c.tree["app.txt"] === "title\ncolor = red\ncolor = blue\nend\n";
      },
    },
  ],
  hintContext: "",
  suggestions: [],
  outro: [],
};

function run(s: GameState, line: string): GameState {
  const out = runPlayerCommand(s, line);
  expect(out.ok, out.state.log.at(-1)?.text).toBe(true);
  return out.state;
}

describe("resolving a merge conflict through the game", () => {
  it("merges, resolves with keep both, adds, commits and wins", () => {
    let s = skipScript(begin(startLevel(sandbox)));
    expect(s.phase).toBe("play");
    s = run(s, "git merge feature");

    const wt = s.repo.worktrees.player;
    expect(Object.keys(wt.conflicts)).toEqual(["app.txt"]);
    expect(conflictSource(wt)).toBe("merge");
    const segs = parseConflicts(wt.workingTree["app.txt"]);
    const [region] = conflictRegions(segs);
    expect(sideLabels("merge", region.oursLabel, region.theirsLabel)).toEqual({
      ours: "Your side (HEAD)",
      theirs: "Their side (feature)",
    });

    const saved = editPlayerFile(s, "app.txt", resolveConflicts(segs, { 0: "both" }));
    expect(saved.ok).toBe(true);
    expect(saved.changed).toBe(true);
    expect(saved.won).toBe(false);
    expect(saved.state.events.some((e) => e.type === "files-changed")).toBe(true);
    expect(saved.state.log.at(-1)).toMatchObject({ kind: "hint", text: "Now stage it with git add app.txt" });
    expect(saved.state.commands).toBe(s.commands);
    // Still conflicted until it is added.
    expect(queries.status(saved.state.repo, "player").conflicted).toEqual(["app.txt"]);

    s = run(saved.state, "git add app.txt");
    expect(queries.status(s.repo, "player").conflicted).toEqual([]);
    s = run(s, "git commit --no-edit");

    const head = queries.resolve(s.repo, "player", "HEAD")!;
    const commit = s.repo.commits[head];
    expect(commit.parents).toHaveLength(2);
    expect(commit.parents[1]).toBe(s.repo.branches.feature);
    expect(commit.tree["app.txt"]).toBe("title\ncolor = red\ncolor = blue\nend\n");
    expect(s.goals).toEqual([true]);
    expect(s.phase === "outro" || s.phase === "won").toBe(true);
  });

  it("allows saving with markers still in the file, like git does", () => {
    let s = run(skipScript(begin(startLevel(sandbox))), "git merge feature");
    const content = s.repo.worktrees.player.workingTree["app.txt"];
    s = editPlayerFile(s, "app.txt", content.replace("title", "Title")).state;
    s = run(s, "git add app.txt");
    expect(hasConflictMarkers(s.repo.worktrees.player.index["app.txt"])).toBe(true);
  });

  it("does nothing outside the player turn", () => {
    const brief = startLevel(sandbox);
    expect(editPlayerFile(brief, "app.txt", "x").state).toBe(brief);
  });

  it("reports an edit that changes nothing as unchanged", () => {
    const s = skipScript(begin(startLevel(sandbox)));
    const same = s.repo.worktrees.player.workingTree["app.txt"];
    const out = editPlayerFile(s, "app.txt", same);
    expect(out.ok).toBe(true);
    expect(engine.edit(s.repo, { kind: "write", actor: "player", path: "app.txt", content: same }).ok).toBe(true);
  });
});
