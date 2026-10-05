// Names that are valid in git but are also members of every JavaScript object. Player input reaches
// the command tables and every record in RepoState, so none of these may find an inherited member.
// tests/oracle/scenarios/special-names.ts runs the same names through real git.

import { describe, expect, it } from "vitest";
import { engine, queries } from "./index";
import { Repo, failOnEngineErrors } from "./test-helpers";

failOnEngineErrors();

const NASTY = ["constructor", "__proto__", "hasOwnProperty", "toString", "valueOf", "prototype"];

function base(): Repo {
  const r = new Repo();
  r.commitFile("a.txt", "a\n", "Base");
  return r;
}

describe("object-member names typed by the player", () => {
  it.each(NASTY)("git %s is not a git command", (name) => {
    const r = base();
    const result = r.fails(name);
    expect(r.text()).toBe(`git: '${name}' is not a git command. See 'git --help'.`);
    expect(result.state).toBe(r.state);
  });

  it.each(NASTY)("bare %s is not a supported shell command", (name) => {
    const r = base();
    const result = engine.run(r.state, { actor: "player", argv: [name] });
    expect(result.ok).toBe(false);
    expect(result.output[0].text).toMatch(/shell commands are not supported/);
  });

  it.each(NASTY)("switching to a missing branch %s fails and leaves HEAD alone", (name) => {
    const r = base();
    const before = r.state;
    r.fails(`switch ${name}`);
    r.fails(`checkout ${name}`);
    r.fails(`checkout ${name}@{1}`);
    r.fails(`merge ${name}`);
    r.fails(`rebase ${name}`);
    r.fails(`branch -d ${name}`);
    r.fails(`push origin ${name}`);
    r.fails(`push ${name} main`);
    r.fails(`reflog ${name}`);
    r.fails(`branch --set-upstream-to=origin/${name}`);
    expect(r.state).toBe(before);
  });

  it.each(NASTY)("%s works as a branch name", (name) => {
    const r = base();
    r.git(`branch ${name}`);
    expect(Object.keys(r.state.branches)).toContain(name);
    expect(Object.getPrototypeOf(r.state.branches)).toBe(Object.prototype);
    r.fails(`branch ${name}`);
    expect(r.text()).toBe(`fatal: a branch named '${name}' already exists`);
    r.git(`switch ${name}`);
    expect(queries.currentBranch(r.state, "player")).toBe(name);
    r.commitFile("b.txt", "b\n", `On ${name}`);
    expect(queries.resolve(r.state, "player", `${name}@{1}`)).toBe(queries.resolve(r.state, "player", "main"));
    expect(queries.history(r.state, r.head()).map((c) => c.message)).toEqual([`On ${name}`, "Base"]);
    r.git(`push -u origin ${name}`);
    expect(Object.keys(r.state.remotes.origin.branches)).toEqual([name]);
    expect(Object.keys(r.state.upstreams)).toEqual([name]);
    r.git("switch main");
    r.git(`merge ${name}`);
    r.git(`branch -m ${name} renamed`);
    expect(Object.keys(r.state.branches).sort()).toEqual(["main", "renamed"]);
    expect(JSON.parse(JSON.stringify(r.state))).toEqual(r.state);
  });

  it.each(NASTY)("%s works as a file path", (name) => {
    const r = base();
    r.write(name, "one\n");
    r.git(`add ${name}`);
    expect(queries.status(r.state, "player").staged).toEqual([{ path: name, change: "added" }]);
    r.git(`commit -m "Add ${name}"`);
    r.write(name, "two\n");
    r.git("stash");
    expect(r.wt().workingTree[name]).toBe("one\n");
    r.git("stash pop");
    r.git(`restore ${name}`);
    r.git(`rm ${name}`);
    expect(Object.keys(r.wt().index)).toEqual(["a.txt"]);
    r.git(`reset -- ${name}`);
    expect(Object.keys(r.wt().index).sort()).toEqual(["a.txt", name].sort());
    expect(Object.getPrototypeOf(r.wt().index)).toBe(Object.prototype);
  });

  it.each(NASTY)("%s works as a robot's worktree and actor", (name) => {
    const r = base();
    r.git(`worktree add /crew/${name} -b work`);
    r.commitFile("b.txt", "b\n", "Robot work", name);
    expect(queries.currentBranch(r.state, name)).toBe("work");
    expect(queries.status(r.state, name).untracked).toEqual([]);
  });

  it("queries answer nothing for object-member names that do not exist", () => {
    const r = base();
    for (const name of NASTY) {
      expect(queries.resolve(r.state, "player", name)).toBeNull();
      expect(queries.history(r.state, name)).toEqual([]);
      expect(queries.currentBranch(r.state, name)).toBeNull();
      expect(queries.isAncestor(r.state, name, r.head())).toBe(false);
      expect(queries.status(r.state, name)).toEqual({ staged: [], unstaged: [], untracked: [], conflicted: [] });
      expect(engine.run(r.state, { actor: name, argv: ["git", "status"] }).ok).toBe(false);
    }
  });
});
