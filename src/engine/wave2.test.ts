// Engine tests for the second wave of commands: rebase, cherry-pick, revert, stash, diff, show and
// the cat/ls shell commands. Whole-scenario behaviour is compared with real git in tests/oracle;
// these pin down output text, reflog wording and events.

import { describe, expect, it } from "vitest";
import { engine, queries } from "./index";
import { Repo } from "./test-helpers";
import type { EngineEvent } from "./types";

const CODE_BEFORE = "function one() {\n  a\n  b\n  c\n  d\n  e\n  f\n  g\n  h\n  i\n  j\n}\nfunction two() {\n  k\n}\n";
const CODE_AFTER = "function one() {\n  a\n  B\n  c\n  d\n  e\n  f\n  g\n  h\n  i\n  j\n}\nfunction two() {\n  k\n  K2\n}\n";

function diffRepo(): Repo {
  const r = new Repo();
  r.write("code.js", CODE_BEFORE);
  r.write("old.txt", "gone\n");
  r.write("nn.txt", "no newline");
  r.git("add .");
  r.git("commit -m Base");
  r.write("code.js", CODE_AFTER);
  r.git("rm -q old.txt");
  r.write("nn.txt", "no newline!");
  r.write("new.txt", "fresh\n");
  r.git("add -A");
  return r;
}

const reflog = (r: Repo, ref = "") => {
  r.git(`reflog ${ref}`);
  return r.text().split("\n");
};

/** feature: X, F (edits a.txt). main: M (edits a.txt the other way). Ends on feature. */
function conflicting(): Repo {
  const r = new Repo();
  r.commitFile("a.txt", "1\n2\n3\n", "Base");
  r.git("switch -c feature");
  r.commitFile("x.txt", "x\n", "X");
  r.commitFile("a.txt", "1\nF\n3\n", "F");
  r.git("switch main");
  r.commitFile("a.txt", "1\nM\n3\n", "M");
  r.git("switch feature");
  return r;
}

describe("git diff", () => {
  // Expected texts were produced by git 2.46 on the same files.
  it("prints a staged diff exactly like git, with function context, new, deleted and no-newline files", () => {
    const r = diffRepo();
    r.git("diff --cached");
    expect(r.text()).toBe(
      [
        "diff --git a/code.js b/code.js",
        "index e7f3f66..28224bf 100644",
        "--- a/code.js",
        "+++ b/code.js",
        "@@ -1,6 +1,6 @@",
        " function one() {",
        "   a",
        "-  b",
        "+  B",
        "   c",
        "   d",
        "   e",
        "@@ -12,4 +12,5 @@ function one() {",
        " }",
        " function two() {",
        "   k",
        "+  K2",
        " }",
        "diff --git a/new.txt b/new.txt",
        "new file mode 100644",
        "index 0000000..92d5444",
        "--- /dev/null",
        "+++ b/new.txt",
        "@@ -0,0 +1 @@",
        "+fresh",
        "diff --git a/nn.txt b/nn.txt",
        "index 20cbb4d..6fe2aa3 100644",
        "--- a/nn.txt",
        "+++ b/nn.txt",
        "@@ -1 +1 @@",
        "-no newline",
        "\\ No newline at end of file",
        "+no newline!",
        "\\ No newline at end of file",
        "diff --git a/old.txt b/old.txt",
        "deleted file mode 100644",
        "index 286c5f5..0000000",
        "--- a/old.txt",
        "+++ /dev/null",
        "@@ -1 +0,0 @@",
        "-gone",
      ].join("\n"),
    );
  });

  it("prints --stat and --name-status like git", () => {
    const r = diffRepo();
    r.git("diff --staged --stat");
    expect(r.text()).toBe(
      [
        " code.js | 3 ++-",
        " new.txt | 1 +",
        " nn.txt  | 2 +-",
        " old.txt | 1 -",
        " 4 files changed, 4 insertions(+), 3 deletions(-)",
      ].join("\n"),
    );
    r.write("empty.txt", "");
    r.git("add empty.txt");
    r.git("diff --cached --name-status");
    expect(r.text()).toBe("M\tcode.js\nA\tempty.txt\nA\tnew.txt\nM\tnn.txt\nD\told.txt");
    r.git("diff --cached -- empty.txt");
    expect(r.text()).toBe("diff --git a/empty.txt b/empty.txt\nnew file mode 100644\nindex 0000000..e69de29");
  });

  it("compares the working files with the index by default, and commits with each other", () => {
    const r = new Repo();
    r.commitFile("a.txt", "one\n", "First");
    r.commitFile("a.txt", "two\n", "Second");
    r.write("a.txt", "three\n");
    r.write("untracked.txt", "ignored\n");
    r.git("diff");
    expect(r.text()).toContain("-two\n+three");
    expect(r.text()).not.toContain("untracked");
    r.git("diff HEAD~1 HEAD");
    expect(r.text()).toContain("-one\n+two");
    r.git("diff HEAD~1..HEAD --name-only");
    expect(r.text()).toBe("a.txt");
    r.git("diff HEAD~1");
    expect(r.text()).toContain("-one\n+three");
    r.git("diff -- a.txt");
    expect(r.text()).toContain("+three");
    expect(r.fails("diff nope").output[0].text).toMatch(/ambiguous argument 'nope'/);
  });

  it("never changes the state", () => {
    const r = diffRepo();
    const before = r.state;
    const result = engine.run(before, { actor: "player", argv: ["git", "diff", "--cached"] });
    expect(result.state).toBe(before);
    expect(result.events).toEqual([]);
  });

  it("lists unmerged paths instead of diffing them", () => {
    const r = conflicting();
    r.git("merge main");
    r.git("diff");
    expect(r.text()).toBe("* Unmerged path a.txt");
  });
});

describe("git show", () => {
  it("prints the commit and its diff, a file at a revision, and a merge without a diff", () => {
    const r = new Repo();
    r.commitFile("a.txt", "one\n", "First");
    const second = r.commitFile("a.txt", "two\n", "Second");
    r.git("show");
    expect(r.text()).toBe(
      [
        `commit ${second} (HEAD -> main)`,
        "Author: player",
        "",
        "    Second",
        "",
        "diff --git a/a.txt b/a.txt",
        "index 5626abf..f719efd 100644",
        "--- a/a.txt",
        "+++ b/a.txt",
        "@@ -1 +1 @@",
        "-one",
        "+two",
      ].join("\n"),
    );
    r.git("show HEAD~1:a.txt");
    expect(r.text()).toBe("one");
    r.git("show --stat HEAD~1");
    expect(r.text()).toContain(" a.txt | 1 +\n 1 file changed, 1 insertion(+)");
    expect(r.fails("show HEAD:nope.txt").output[0].text).toBe("fatal: path 'nope.txt' does not exist in 'HEAD'");
  });
});

describe("cat and ls", () => {
  it("print working files and folders, with shell errors", () => {
    const r = new Repo();
    r.write("readme.md", "hello\nworld\n");
    r.write("src/app.ts", "app\n");
    r.write("src/lib/util.ts", "util\n");
    const run = (argv: string[]) => engine.run(r.state, { actor: "player", argv });
    const text = (argv: string[]) => run(argv).output.map((l) => l.text).join("\n");
    expect(text(["cat", "readme.md"])).toBe("hello\nworld");
    expect(text(["ls"])).toBe("readme.md\nsrc/");
    expect(text(["ls", "src"])).toBe("app.ts\nlib/");
    expect(run(["cat", "src"]).output[0].text).toBe("cat: src: Is a directory");
    expect(run(["cat", "nope"]).ok).toBe(false);
    expect(run(["cat", "nope"]).output[0].text).toBe("cat: nope: No such file or directory");
    expect(run(["ls", "nope"]).output[0].text).toBe("ls: cannot access 'nope': No such file or directory");
    expect(run(["ls", "src"]).state).toBe(r.state);
  });
});

describe("git rebase", () => {
  it("writes git's reflog lines and moves the branch with reason rebase", () => {
    const r = new Repo();
    r.commitFile("a.txt", "1\n", "Base");
    r.git("switch -c feature");
    const oldTip = r.commitFile("x.txt", "x\n", "X");
    r.git("switch main");
    const main = r.commitFile("m.txt", "m\n", "M");
    r.git("switch feature");
    const result = r.git("rebase main");
    expect(reflog(r).slice(0, 3).map((l) => l.slice(8))).toEqual([
      "HEAD@{0}: rebase (finish): returning to refs/heads/feature",
      "HEAD@{1}: rebase (pick): X",
      "HEAD@{2}: rebase (start): checkout main",
    ]);
    expect(reflog(r, "feature")[0].slice(8)).toBe(`feature@{0}: rebase (finish): refs/heads/feature onto ${main}`);
    const moved = result.events.find((e) => e.type === "branch-moved");
    expect(moved).toMatchObject({ name: "feature", from: oldTip, reason: "rebase" });
    expect(result.events).toContainEqual({ type: "commits-lost", oids: [oldTip] });
    expect(result.output.map((l) => l.text)).toEqual(["Successfully rebased and updated refs/heads/feature."]);
  });

  it("stops on a conflict with a rebase in progress, and finishes on --continue", () => {
    const r = conflicting();
    const stopped = r.git("rebase main");
    const ip = r.wt().inProgress;
    expect(ip?.kind).toBe("rebase");
    expect(r.wt().head.kind).toBe("detached");
    expect(stopped.events.map((e) => e.type)).toContain("conflict");
    expect(stopped.events).toContainEqual({ type: "operation", actor: "player", kind: "rebase", phase: "stopped" });
    expect(r.wt().workingTree["a.txt"]).toMatch(/<<<<<<< HEAD\nM\n=======\nF\n>>>>>>> [0-9a-f]{7} \(F\)\n/);
    r.git("status");
    expect(r.text()).toContain("interactive rebase in progress; onto");
    expect(r.text()).toContain("You are currently rebasing branch 'feature' on");
    r.write("a.txt", "1\nMF\n3\n");
    r.git("add a.txt");
    const done = r.git("rebase --continue");
    expect(done.events).toContainEqual({ type: "operation", actor: "player", kind: "rebase", phase: "completed" });
    expect(r.wt().inProgress).toBeNull();
    expect(r.wt().head).toEqual({ kind: "branch", name: "feature" });
    expect(reflog(r)[1].slice(8)).toBe("HEAD@{1}: rebase (continue): F");
  });

  it("aborts back to the branch with git's wording", () => {
    const r = conflicting();
    const tip = r.head();
    r.git("rebase main");
    r.git("rebase --abort");
    expect(r.head()).toBe(tip);
    expect(r.wt().head).toEqual({ kind: "branch", name: "feature" });
    expect(reflog(r)[0].slice(8)).toBe("HEAD@{0}: rebase (abort): returning to refs/heads/feature");
    expect(r.wt().conflicts).toEqual({});
  });

  it("refuses interactive rebase with a friendly message", () => {
    const r = conflicting();
    expect(r.fails("rebase -i main").output[0].text).toBe("git rebase -i (interactive rebase) is not supported in Merge Crew yet");
  });

  it("pull --rebase names the pull in the reflog", () => {
    const r = new Repo();
    r.commitFile("a.txt", "1\n", "Base");
    r.git("push -u origin main");
    r.git("worktree add /crew/blaze -b blaze origin/main");
    r.commitFile("b.txt", "b\n", "Blaze", "blaze");
    r.git("push origin blaze:main", "blaze");
    r.commitFile("p.txt", "p\n", "Player");
    r.git("pull --rebase");
    const lines = reflog(r).map((l) => l.slice(8));
    expect(lines[0]).toBe("HEAD@{0}: pull --rebase (finish): returning to refs/heads/main");
    expect(lines[1]).toBe("HEAD@{1}: pull --rebase (pick): Player");
    expect(lines[2]).toMatch(/^HEAD@\{2\}: pull --rebase \(start\): checkout [0-9a-f]{40}$/);
    // The remote-tracking ref has a reflog too.
    expect(queries.resolve(r.state, "player", "origin/main@{1}")).toBe(queries.resolve(r.state, "player", "main~2"));
  });
});

describe("git cherry-pick and git revert", () => {
  it("cherry-pick keeps the author and writes git's reflog line", () => {
    const r = new Repo();
    r.commitFile("a.txt", "1\n", "Base");
    r.git("worktree add /crew/drift");
    const picked = r.commitFile("d.txt", "d\n", "Drift idea", "drift");
    r.git(`cherry-pick ${picked.slice(0, 7)}`);
    const head = r.state.commits[r.head()];
    expect(head.author).toBe("drift");
    expect(head.message).toBe("Drift idea");
    expect(head.oid).not.toBe(picked);
    expect(reflog(r)[0].slice(8)).toBe("HEAD@{0}: cherry-pick: Drift idea");
  });

  it("revert writes git's message, and a revert of a revert says Reapply", () => {
    const r = new Repo();
    r.commitFile("a.txt", "1\n", "Base");
    const add = r.commitFile("b.txt", "b\n", "Add b");
    r.git("revert HEAD");
    expect(r.msg(r.head())).toBe(`Revert "Add b"\n\nThis reverts commit ${add}.`);
    expect(r.text()).toMatch(/^\[main [0-9a-f]{7}\] Revert "Add b"$/);
    const revertOid = r.head();
    r.git("revert --no-edit HEAD");
    expect(r.msg(r.head())).toBe(`Reapply "Add b"\n\nThis reverts commit ${revertOid}.`);
    expect(reflog(r)[0].slice(8)).toBe('HEAD@{0}: revert: Reapply "Add b"');
  });

  it("a conflicting cherry-pick stops with kind cherry-pick and --abort restores everything", () => {
    const r = conflicting();
    r.git("switch main");
    const before = r.state;
    const stopped = r.git("cherry-pick feature");
    expect(r.wt().inProgress?.kind).toBe("cherry-pick");
    expect(stopped.events).toContainEqual({ type: "operation", actor: "player", kind: "cherry-pick", phase: "stopped" });
    const aborted = r.git("cherry-pick --abort");
    expect(aborted.events.some((e: EngineEvent) => e.type === "conflict-resolved")).toBe(false);
    expect(r.wt().workingTree).toEqual(before.worktrees.player.workingTree);
    expect(r.wt().inProgress).toBeNull();
  });
});

describe("git stash", () => {
  it("stores stash commits like git: base and index commit as parents, untracked as the third", () => {
    const r = new Repo();
    const base = r.commitFile("a.txt", "1\n", "Base");
    r.write("a.txt", "2\n");
    r.write("n.txt", "new\n");
    r.git("add n.txt");
    r.write("u.txt", "untracked\n");
    const result = r.git("stash -u");
    const [entry] = r.state.stash;
    expect(entry.message).toBe(`WIP on main: ${base.slice(0, 7)} Base`);
    expect(entry.base).toBe(base);
    const commit = r.state.commits[entry.oid];
    expect(commit.parents[0]).toBe(base);
    expect(r.state.commits[commit.parents[1]].message).toBe(`index on main: ${base.slice(0, 7)} Base`);
    expect(r.state.commits[commit.parents[1]].tree).toEqual(entry.index);
    expect(r.state.commits[commit.parents[2]].tree).toEqual({ "u.txt": "untracked\n" });
    expect(entry.workingTree).toEqual({ "a.txt": "2\n", "n.txt": "new\n" });
    expect(r.wt().workingTree).toEqual({ "a.txt": "1\n" });
    expect(result.events).toContainEqual({ type: "stash-pushed", actor: "player", oid: entry.oid });
    expect(queries.lost(r.state)).toEqual([]);
    r.git("stash show");
    expect(r.text()).toBe(" a.txt | 2 +-\n n.txt | 1 +\n 2 files changed, 2 insertions(+), 1 deletion(-)");
    const popped = r.git("stash pop");
    expect(popped.events).toContainEqual({ type: "stash-removed", actor: "player", oid: entry.oid, applied: true });
    expect(r.text()).toContain(`Dropped refs/stash@{0} (${entry.oid})`);
    expect(r.wt().workingTree).toEqual({ "a.txt": "2\n", "n.txt": "new\n", "u.txt": "untracked\n" });
    expect(r.wt().index).toEqual({ "a.txt": "1\n", "n.txt": "new\n" });
  });

  it("a conflicting pop keeps the entry and marks the conflict with git's labels", () => {
    const r = new Repo();
    r.commitFile("a.txt", "1\n2\n3\n", "Base");
    r.write("a.txt", "1\nstashed\n3\n");
    r.git("stash");
    r.commitFile("a.txt", "1\ncommitted\n3\n", "Change");
    const result = r.git("stash pop");
    expect(result.ok).toBe(true);
    expect(r.state.stash).toHaveLength(1);
    expect(r.text()).toContain("The stash entry is kept in case you need it again.");
    expect(r.wt().workingTree["a.txt"]).toBe("1\n<<<<<<< Updated upstream\ncommitted\n=======\nstashed\n>>>>>>> Stashed changes\n3\n");
    expect(r.wt().inProgress).toBeNull();
  });

  it("stash@{n} works as a revision", () => {
    const r = new Repo();
    r.commitFile("a.txt", "1\n", "Base");
    r.write("a.txt", "2\n");
    r.git("stash");
    expect(queries.resolve(r.state, "player", "stash@{0}")).toBe(r.state.stash[0].oid);
    r.git("show stash:a.txt");
    expect(r.text()).toBe("2");
  });
});
