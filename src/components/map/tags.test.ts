import { describe, expect, it } from "vitest";
import { RepoBuilder, linear, merge } from "./fixtures";
import { layoutRepo } from "./layout";
import { buildTags, labelAtLineEnd, tagTitle } from "./tags";

describe("buildTags", () => {
  it("tags a remote branch on its stop and leaves line-end branches alone", () => {
    const layout = layoutRepo(linear.state);
    const tags = buildTags(layout, linear.state);
    const all = [...tags.values()].flat();
    expect(all.map((t) => [t.kind, t.text])).toEqual([["remote", "origin/main"]]);
    expect(layout.branchLabels.every((b) => labelAtLineEnd(layout, b))).toBe(true);
  });

  it("splits a remote ref into server and tracking tags when they disagree, and tags the stash base", () => {
    const b = new RepoBuilder()
      .commit("a", { message: "a" })
      .commit("b", { parents: ["a"], message: "b" })
      .branch("main", "b")
      .remote("main", "b")
      .tracking("origin/main", "a")
      .worktree("player", { branch: "main" })
      .stash("st", "a", "WIP on main");
    const state = b.build();
    const tags = buildTags(layoutRepo(state), state);
    expect(tags.get(b.oid("b"))!.map((t) => t.kind)).toEqual(["remote"]);
    expect(tags.get(b.oid("a"))!.map((t) => t.kind)).toEqual(["tracking", "stash"]);
    expect(tags.get(b.oid("a"))!.map(tagTitle)).toEqual([
      "origin/main: where this repository last saw the remote branch",
      "stash@{0}: stashed work based here",
    ]);
  });

  it("gives a branch that merged back a tag instead of a line-end label", () => {
    const state = merge.scenes[0].after;
    const layout = layoutRepo(state);
    const merged = layout.branchLabels.filter((b) => !labelAtLineEnd(layout, b));
    const tagged = [...buildTags(layout, state).values()].flat().filter((t) => t.kind === "branch").map((t) => t.text);
    expect(tagged).toEqual(merged.map((b) => b.name));
  });
});
