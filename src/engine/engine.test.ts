// Engine behaviour tests. The oracle suite in tests/oracle compares whole scenarios with real git;
// these pin down engine-specific contract details (events, clock, errors) and git rules case by case.

import { describe, expect, it } from "vitest";
import { engine, queries } from "./index";
import { Repo } from "./test-helpers";
import type { EngineEvent } from "./types";

const types = (events: EngineEvent[]) => events.map((e) => e.type);

describe("createRepo", () => {
  it("starts on an unborn main with an empty origin", () => {
    const s = engine.createRepo();
    expect(s.worktrees.player.path).toBe("/repo");
    expect(s.worktrees.player.head).toEqual({ kind: "branch", name: "main" });
    expect(s.branches).toEqual({});
    expect(s.remotes).toEqual({ origin: { name: "origin", branches: {} } });
    expect(engine.createRepo({ withOrigin: false }).remotes).toEqual({});
  });
});

describe("parseCommandLine", () => {
  it("handles quotes and escapes", () => {
    expect(engine.parseCommandLine(`git commit -m "Add login" -m 'two words'`)).toEqual([
      "git",
      "commit",
      "-m",
      "Add login",
      "-m",
      "two words",
    ]);
    expect(engine.parseCommandLine(`  git   commit -m ""  `)).toEqual(["git", "commit", "-m", ""]);
    expect(engine.parseCommandLine(`echo "say \\"hi\\"" a\\ b`)).toEqual(["echo", 'say "hi"', "a b"]);
  });
});

describe("run: contract", () => {
  it("returns the same state object and no events for a failed command", () => {
    const r = new Repo();
    const before = r.state;
    const result = r.fails("commit -m nothing");
    expect(result.state).toBe(before);
    expect(result.events).toEqual([]);
    expect(result.output.some((l) => l.kind === "error")).toBe(true);
  });

  it("does not mutate the input state", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    const snapshot = JSON.stringify(r.state);
    const frozen = r.state;
    engine.run(frozen, { actor: "player", argv: ["git", "switch", "-c", "x"] });
    engine.run(frozen, { actor: "player", argv: ["git", "reset", "--hard", "HEAD"] });
    expect(JSON.stringify(frozen)).toBe(snapshot);
  });

  it("ticks the clock only for commands that change something", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    const clock = r.state.clock;
    r.git("status");
    r.git("log --oneline");
    expect(r.state.clock).toBe(clock);
    r.git("branch feature");
    expect(r.state.clock).toBe(clock + 1);
    expect(r.state.branchReflogs.feature[0].time).toBe(clock + 1);
  });

  it("reports later-wave commands and shell commands as not supported", () => {
    const r = new Repo();
    expect(r.fails("rebase main").output[0].text).toMatch(/not supported in Merge Crew yet/);
    const shell = engine.run(r.state, { actor: "player", argv: ["ls"] });
    expect(shell.ok).toBe(false);
    expect(shell.output[0].text).toMatch(/not supported/);
    expect(r.fails("commit --fixup HEAD").output[0].text).toMatch(/not supported/);
  });

  it("makes deterministic commit ids", () => {
    const a = new Repo();
    const b = new Repo();
    expect(a.commitFile("a.txt", "a\n", "Same")).toBe(b.commitFile("a.txt", "a\n", "Same"));
    expect(a.head()).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("edit", () => {
  it("writes and deletes working files and emits files-changed", () => {
    const s = engine.createRepo();
    const w = engine.edit(s, { kind: "write", actor: "player", path: "./notes.md", content: "hi\n" });
    expect(w.state.worktrees.player.workingTree).toEqual({ "notes.md": "hi\n" });
    expect(w.events).toEqual([{ type: "files-changed", actor: "player", area: "working", paths: ["notes.md"] }]);
    const d = engine.edit(w.state, { kind: "delete", actor: "player", path: "notes.md" });
    expect(d.state.worktrees.player.workingTree).toEqual({});
    expect(engine.edit(s, { kind: "write", actor: "nobody", path: "x", content: "" }).ok).toBe(false);
  });
});

describe("commit", () => {
  it("writes git's reflog wording and emits commit then branch events", () => {
    const r = new Repo();
    r.write("a.txt", "a\n");
    r.git("add a.txt");
    const first = r.git(`commit -m "Add a"`);
    expect(types(first.events)).toEqual(["commit-created", "branch-created"]);
    r.write("a.txt", "b\n");
    const second = r.git("commit -am Change");
    expect(types(second.events)).toEqual(["commit-created", "branch-moved", "files-changed"]);
    expect(second.events[2]).toEqual({ type: "files-changed", actor: "player", area: "index", paths: ["a.txt"] });
    r.git("commit --amend -m Changed");
    expect(r.state.branchReflogs.main.map((e) => e.message)).toEqual([
      "commit (initial): Add a",
      "commit: Change",
      "commit (amend): Changed",
    ]);
    expect(r.wt().headReflog.map((e) => e.previous === null)).toEqual([true, false, false]);
  });

  it("cleans up whitespace in messages and joins several -m paragraphs", () => {
    const r = new Repo();
    r.write("a.txt", "a\n");
    r.git("add .");
    r.git(`commit -m "  Title  " -m "Body"`);
    expect(r.msg(r.head())).toBe("  Title\n\nBody");
  });

  it("refuses an empty commit, an empty message and an amend on an unborn branch", () => {
    const r = new Repo();
    expect(r.fails("commit -m Nothing").output.map((l) => l.text)).toContain(
      'nothing to commit (create/copy files and use "git add" to track)',
    );
    r.write("a.txt", "a\n");
    r.git("add a.txt");
    r.fails(`commit -m ""`);
    r.fails("commit");
    r.fails("commit --amend -m x");
    r.git("commit -m First --allow-empty");
    r.git("commit --allow-empty -m Empty");
    expect(r.fails("commit --amend -m Still-empty").output[0].text).toMatch(/would make\s*$/);
  });
});

describe("branches and switching", () => {
  it("creates, renames and deletes branches", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    r.git("branch feature");
    r.fails("branch feature");
    r.fails("branch bad..name");
    r.git("branch -m feature topic");
    expect(Object.keys(r.state.branches).sort()).toEqual(["main", "topic"]);
    expect(r.state.branchReflogs.topic.map((e) => e.message)).toEqual([
      "branch: Created from HEAD",
      "Branch: renamed refs/heads/feature to refs/heads/topic",
    ]);
    const del = r.git("branch -d topic");
    expect(del.events).toContainEqual({ type: "branch-deleted", actor: "player", name: "topic", oid: r.head() });
    r.fails("branch -d main");
  });

  it("carries local changes across a switch and refuses to overwrite them", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    r.git("switch -c feature");
    r.commitFile("a.txt", "feature\n", "Feature");
    r.git("switch main");
    r.write("b.txt", "new\n");
    r.git("switch feature");
    expect(r.wt().workingTree["b.txt"]).toBe("new\n");
    r.write("a.txt", "local\n");
    expect(r.fails("switch main").output[0].text).toBe(
      "error: Your local changes to the following files would be overwritten by checkout:",
    );
  });

  it("logs checkouts with git's wording, including detached ones and switch -", () => {
    const r = new Repo();
    const first = r.commitFile("a.txt", "a\n", "First");
    r.commitFile("a.txt", "b\n", "Second");
    r.git("checkout HEAD~1");
    expect(r.wt().head).toEqual({ kind: "detached", oid: first });
    r.git("switch -");
    expect(r.wt().head).toEqual({ kind: "branch", name: "main" });
    expect(r.wt().headReflog.slice(-2).map((e) => e.message)).toEqual([
      "checkout: moving from main to HEAD~1",
      `checkout: moving from ${first} to main`,
    ]);
    r.fails("switch HEAD~1");
  });

  it("creates a tracking branch from a remote branch with the same name", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    r.git("push origin main:feature");
    r.git("switch feature");
    expect(r.state.upstreams.feature).toEqual({ remote: "origin", branch: "feature" });
    expect(r.state.branchReflogs.feature[0].message).toBe("branch: Created from refs/remotes/origin/feature");
  });
});

describe("restore, checkout -- and reset", () => {
  it("restores working files and unstages", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    r.write("a.txt", "changed\n");
    r.git("add a.txt");
    r.git("restore --staged a.txt");
    expect(r.wt().index["a.txt"]).toBe("a\n");
    expect(r.wt().workingTree["a.txt"]).toBe("changed\n");
    r.git("checkout -- a.txt");
    expect(r.wt().workingTree["a.txt"]).toBe("a\n");
    r.fails("restore nope.txt");
  });

  it("reset modes move the branch and treat index and files like git", () => {
    const r = new Repo();
    const first = r.commitFile("a.txt", "a\n", "First");
    const second = r.commitFile("b.txt", "b\n", "Second");
    r.write("u.txt", "untracked\n");
    r.git("reset --soft HEAD~1");
    expect(r.wt().index["b.txt"]).toBe("b\n");
    r.git(`reset --hard ${second.slice(0, 7)}`);
    r.git("reset HEAD~1");
    expect(r.wt().index["b.txt"]).toBeUndefined();
    expect(r.wt().workingTree["b.txt"]).toBe("b\n");
    const hard = r.git("reset --hard HEAD");
    expect(r.wt().workingTree).toEqual({ "a.txt": "a\n", "b.txt": "b\n", "u.txt": "untracked\n" });
    expect(r.head()).toBe(first);
    expect(hard.events).toEqual([]);
    // Resetting to where the branch already is logs HEAD but not the branch.
    expect(r.wt().headReflog.at(-1)?.message).toBe("reset: moving to HEAD");
    expect(r.state.branchReflogs.main.at(-1)?.message).toBe("reset: moving to HEAD~1");
  });

  it("reports commits lost by a reset and found again through the reflog", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    const second = r.commitFile("a.txt", "b\n", "Second");
    const lost = r.git("reset --hard HEAD~1");
    expect(lost.events).toContainEqual({ type: "commits-lost", oids: [second] });
    expect(queries.lost(r.state)).toEqual([second]);
    const back = r.git("reset --hard HEAD@{1}");
    expect(back.events).toContainEqual({ type: "commits-recovered", oids: [second] });
  });
});

describe("merge", () => {
  function diverged() {
    const r = new Repo();
    r.commitFile("a.txt", "line 1\nline 2\nline 3\n", "Base");
    r.git("switch -c feature");
    r.commitFile("a.txt", "line 1\nfeature\nline 3\n", "Feature");
    r.git("switch main");
    r.commitFile("a.txt", "line 1\nmain\nline 3\n", "Main");
    return r;
  }

  it("fast-forwards with git's reflog wording", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    r.git("switch -c feature");
    const tip = r.commitFile("b.txt", "b\n", "Feature");
    r.git("switch main");
    const result = r.git("merge feature");
    expect(r.head()).toBe(tip);
    expect(result.events[0]).toMatchObject({ type: "branch-moved", reason: "fast-forward" });
    expect(r.state.branchReflogs.main.at(-1)?.message).toBe("merge feature: Fast-forward");
    expect(r.git("merge feature").output[0].text).toBe("Already up to date.");
  });

  it("stops on a conflict with markers, conflict entries and events", () => {
    const r = diverged();
    const result = r.git("merge feature");
    expect(result.ok).toBe(true);
    expect(types(result.events).slice(0, 3)).toEqual(["operation", "conflict", "operation"]);
    const wt = r.wt();
    expect(wt.workingTree["a.txt"]).toBe("line 1\n<<<<<<< HEAD\nmain\n=======\nfeature\n>>>>>>> feature\nline 3\n");
    expect(wt.conflicts["a.txt"]).toEqual({
      base: "line 1\nline 2\nline 3\n",
      ours: "line 1\nmain\nline 3\n",
      theirs: "line 1\nfeature\nline 3\n",
    });
    expect(wt.index["a.txt"]).toBeUndefined();
    expect(wt.inProgress).toEqual({ kind: "merge", theirs: r.state.branches.feature, message: "Merge branch 'feature'" });
    expect(queries.status(r.state, "player").conflicted).toEqual(["a.txt"]);
    r.fails("commit -m Early");
    r.fails("switch feature");

    r.write("a.txt", "line 1\nboth\nline 3\n");
    const added = r.git("add a.txt");
    expect(added.events).toContainEqual({ type: "conflict-resolved", actor: "player", paths: ["a.txt"] });
    const done = r.git("commit");
    expect(done.events).toContainEqual({ type: "operation", actor: "player", kind: "merge", phase: "completed" });
    const merge = r.state.commits[r.head()];
    expect(merge.parents).toEqual([r.state.branchReflogs.main.at(-2)?.oid, r.state.branches.feature]);
    expect(merge.message).toBe("Merge branch 'feature'");
    expect(r.wt().headReflog.at(-1)?.message).toBe("commit (merge): Merge branch 'feature'");
  });

  it("aborts a conflicted merge back to HEAD and keeps unrelated local edits", () => {
    const r = diverged();
    r.git("merge feature");
    r.write("other.txt", "untracked\n");
    const result = r.git("merge --abort");
    expect(types(result.events)).not.toContain("conflict-resolved");
    expect(r.wt().workingTree).toEqual({ "a.txt": "line 1\nmain\nline 3\n", "other.txt": "untracked\n" });
    expect(r.wt().inProgress).toBeNull();
    expect(r.wt().headReflog.at(-1)?.message).toBe("reset: moving to HEAD");
  });

  it("refuses to merge with staged changes", () => {
    const r = diverged();
    r.write("x.txt", "x\n");
    r.git("add x.txt");
    expect(r.fails("merge feature").output[0].text).toMatch(/would be overwritten by merge/);
  });

  it("names merges like fmt-merge-msg", () => {
    const r = diverged();
    r.git("switch -c dev");
    r.git("merge feature");
    expect(r.wt().inProgress).toMatchObject({ message: "Merge branch 'feature' into dev" });
  });
});

describe("remotes", () => {
  it("pushes with upstream, rejects non-fast-forward, force-pushes and loses commits", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    const second = r.commitFile("a.txt", "b\n", "Second");
    const pushed = r.git("push -u origin main");
    expect(r.state.upstreams.main).toEqual({ remote: "origin", branch: "main" });
    expect(r.state.remotes.origin.branches.main).toBe(second);
    expect(types(pushed.events)).toEqual(["remote-updated", "remote-tracking-updated"]);
    r.git("reset --hard HEAD~1");
    r.commitFile("a.txt", "c\n", "Rewrite");
    r.fails("push");
    const forced = r.git("push --force");
    expect(forced.events[0]).toMatchObject({ type: "remote-updated", forced: true });
    expect(forced.events).toContainEqual({ type: "commits-lost", oids: [second] });
  });

  it("fetches, fast-forwards with pull and merges diverged history", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    r.git("push -u origin main");
    r.git("worktree add ../crew/blaze");
    r.git("switch main", "blaze", true);
    r.git("switch --detach main", "blaze");
    r.commitFile("b.txt", "b\n", "Blaze", "blaze");
    r.git("push origin HEAD:main", "blaze");
    r.git("pull");
    expect(r.msg(r.head())).toBe("Blaze");
    expect(r.wt().headReflog.at(-1)?.message).toBe("pull: Fast-forward");

    r.commitFile("c.txt", "c\n", "Player", "player");
    r.commitFile("d.txt", "d\n", "Blaze again", "blaze");
    r.git("push origin HEAD:main", "blaze");
    r.git("pull");
    expect(r.msg(r.head())).toBe("Merge branch 'main' of origin");
    expect(r.state.commits[r.head()].parents).toHaveLength(2);
  });
});

describe("worktrees", () => {
  it("maps the last path segment to the actor and creates a branch named after it", () => {
    const r = new Repo();
    r.commitFile("a.txt", "a\n", "First");
    const result = r.git("worktree add ../crew/blaze");
    const wt = r.wt("blaze");
    expect(wt.path).toBe("/crew/blaze");
    expect(wt.head).toEqual({ kind: "branch", name: "blaze" });
    expect(wt.workingTree).toEqual({ "a.txt": "a\n" });
    expect(wt.headReflog.map((e) => e.message)).toEqual(["", "reset: moving to HEAD"]);
    expect(result.events).toContainEqual({
      type: "worktree-added",
      actor: "blaze",
      path: "/crew/blaze",
      head: { kind: "branch", name: "blaze" },
    });
    r.fails("worktree add /crew/tidy blaze");
    r.git("worktree add /crew/tidy -b tidy-work");
    expect(r.wt("tidy").head).toEqual({ kind: "branch", name: "tidy-work" });
    r.commitFile("t.txt", "t\n", "Tidy", "tidy");
    expect(r.state.commits[r.state.branches["tidy-work"]].author).toBe("tidy");
    expect(r.wt().workingTree["t.txt"]).toBeUndefined();
  });

  it("fails for an actor without a worktree", () => {
    const r = new Repo();
    expect(r.fails("status", "drift").output[0].text).toMatch(/not a git repository/);
  });
});
