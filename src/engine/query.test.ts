import { describe, expect, it } from "vitest";
import { queries } from "./query";
import { Repo } from "./test-helpers";

describe("queries.resolve", () => {
  function history() {
    const r = new Repo();
    const a = r.commitFile("f.txt", "1\n", "A");
    r.git("switch -c side");
    const s = r.commitFile("s.txt", "s\n", "S");
    r.git("switch main");
    const b = r.commitFile("f.txt", "2\n", "B");
    r.git("merge side -m M");
    const m = r.head();
    return { r, a, b, s, m };
  }

  it("resolves names, oids and navigation suffixes", () => {
    const { r, a, b, s, m } = history();
    const resolve = (rev: string) => queries.resolve(r.state, "player", rev);
    expect(resolve("HEAD")).toBe(m);
    expect(resolve("@")).toBe(m);
    expect(resolve("main")).toBe(m);
    expect(resolve("refs/heads/side")).toBe(s);
    expect(resolve(m.slice(0, 4))).toBe(m);
    expect(resolve(m.slice(0, 3))).toBeNull();
    expect(resolve("HEAD^")).toBe(b);
    expect(resolve("HEAD^2")).toBe(s);
    expect(resolve("HEAD^3")).toBeNull();
    expect(resolve("HEAD~2")).toBe(a);
    expect(resolve("main^^")).toBe(a);
    expect(resolve("HEAD^0")).toBe(m);
    expect(resolve("nope")).toBeNull();
  });

  it("reads reflogs with @{n} and @{-n}", () => {
    const { r, b, m } = history();
    const resolve = (rev: string) => queries.resolve(r.state, "player", rev);
    expect(resolve("main@{0}")).toBe(m);
    expect(resolve("main@{1}")).toBe(b);
    expect(resolve("@{1}")).toBe(b);
    expect(resolve("HEAD@{1}")).toBe(b);
    expect(resolve("@{-1}")).toBe(r.state.branches.side);
    expect(resolve("main@{99}")).toBeNull();
  });

  it("resolves remote-tracking refs and @{u}", () => {
    const { r, m } = history();
    r.git("push -u origin main");
    expect(queries.resolve(r.state, "player", "origin/main")).toBe(m);
    expect(queries.resolve(r.state, "player", "remotes/origin/main")).toBe(m);
    expect(queries.resolve(r.state, "player", "@{u}")).toBe(m);
  });
});

describe("queries", () => {
  it("answers ancestry, history order and the current branch", () => {
    const r = new Repo();
    expect(queries.currentBranch(r.state, "player")).toBeNull();
    const a = r.commitFile("f.txt", "1\n", "A");
    const b = r.commitFile("f.txt", "2\n", "B");
    expect(queries.currentBranch(r.state, "player")).toBe("main");
    expect(queries.isAncestor(r.state, a, b)).toBe(true);
    expect(queries.isAncestor(r.state, b, a)).toBe(false);
    expect(queries.history(r.state, b).map((c) => c.message)).toEqual(["B", "A"]);
    r.git("checkout HEAD~1");
    expect(queries.currentBranch(r.state, "player")).toBeNull();
  });

  it("groups status like git status", () => {
    const r = new Repo();
    r.commitFile("keep.txt", "k\n", "A");
    r.commitFile("gone.txt", "g\n", "B");
    r.write("keep.txt", "changed\n");
    r.write("new.txt", "n\n");
    r.git("add new.txt");
    r.remove("gone.txt");
    r.write("loose.txt", "l\n");
    expect(queries.status(r.state, "player")).toEqual({
      staged: [{ path: "new.txt", change: "added" }],
      unstaged: [
        { path: "gone.txt", change: "deleted" },
        { path: "keep.txt", change: "modified" },
      ],
      untracked: ["loose.txt"],
      conflicted: [],
    });
  });

  it("counts commits on remote branches and the stash as reachable", () => {
    const r = new Repo();
    r.commitFile("f.txt", "1\n", "A");
    const b = r.commitFile("f.txt", "2\n", "B");
    r.git("push origin main");
    r.git("reset --hard HEAD~1");
    expect(queries.reachable(r.state).has(b)).toBe(true);
    expect(queries.lost(r.state)).toEqual([]);
  });
});
