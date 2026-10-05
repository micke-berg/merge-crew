import { describe, expect, it } from "vitest";
import { busy, crew, forcePush, linear, merge, RepoBuilder } from "./fixtures";
import { layoutRepo, reachability, topoOrder } from "./layout";

const byOid = <T extends { oid: string }>(xs: T[]) => new Map(xs.map((x) => [x.oid, x]));

describe("layoutRepo", () => {
  it("puts a linear history on one straight row in commit order", () => {
    const layout = layoutRepo(linear.state);
    expect(layout.stops.map((s) => s.row)).toEqual([0, 0, 0]);
    expect(layout.stops.map((s) => s.col)).toEqual([0, 1, 2]);
    expect(layout.stops.map((s) => s.message)).toEqual(["Initial commit", "Add README", "Add login form"]);
    expect(layout.edges.every((e) => e.kind === "straight")).toBe(true);
    expect(layout.ghostRow).toBeNull();
    expect(layout.lanes).toHaveLength(1);
    expect(layout.lanes[0]).toMatchObject({ kind: "main", name: "main", row: 0 });
  });

  it("labels main at its line end and tags the remote where it points", () => {
    const layout = layoutRepo(linear.state);
    expect(layout.branchLabels).toEqual([expect.objectContaining({ name: "main", atLineEnd: true, checkedOutBy: ["player"] })]);
    expect(layout.remoteTags).toEqual([expect.objectContaining({ ref: "origin/main", col: 1, source: "both" })]);
  });

  it("gives each branch its own row, stacked above and below main by creation order", () => {
    const layout = layoutRepo(crew.state);
    const rowOf = (name: string) => layout.lanes.find((l) => l.name === name)!.row;
    expect(rowOf("main")).toBe(0);
    expect(rowOf("docs")).toBe(-1);
    expect(rowOf("blaze/turbo")).toBe(1);
    expect(rowOf("drift/dark-theme")).toBe(-2);
    // Every branch line lifts off with a fork edge from its parent on main.
    const forks = layout.edges.filter((e) => e.kind === "fork");
    expect(forks).toHaveLength(3);
    expect(forks.every((f) => f.fromRow === 0)).toBe(true);
  });

  it("orders columns topologically with commit time as the tie-break", () => {
    const layout = layoutRepo(crew.state);
    const stops = byOid(layout.stops);
    for (const e of layout.edges) expect(stops.get(e.from)!.col).toBeLessThan(stops.get(e.to)!.col);
    const times = layout.stops.map((s) => s.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("puts each robot at the tip of the branch it has checked out", () => {
    const layout = layoutRepo(crew.state);
    const tipOf = (b: string) => crew.state.branches[b];
    const head = (a: string) => layout.heads.find((h) => h.actor === a)!;
    expect(head("player").oid).toBe(tipOf("main"));
    expect(head("tidy").oid).toBe(tipOf("docs"));
    expect(head("blaze").oid).toBe(tipOf("blaze/turbo"));
    expect(head("drift")).toMatchObject({ oid: tipOf("drift/dark-theme"), branch: "drift/dark-theme", detached: false, slot: 0, slots: 1 });
  });

  it("draws a merge edge from the branch tip back into the target lane", () => {
    const layout = layoutRepo(merge.scenes[0].after);
    const mergeStop = layout.stops.find((s) => s.merge)!;
    expect(mergeStop.row).toBe(0);
    const mergeEdges = layout.edges.filter((e) => e.kind === "merge");
    expect(mergeEdges).toHaveLength(1);
    expect(mergeEdges[0]).toMatchObject({ to: mergeStop.oid, toRow: 0, fromRow: -1, parentIndex: 1 });
    const lane = layout.lanes.find((l) => l.name === "checkout")!;
    expect(lane.end).toBe(mergeStop.col);
  });

  it("keeps merged history on an anonymous lane after its branch is deleted", () => {
    const b = new RepoBuilder()
      .commit("a", { message: "a" })
      .commit("f", { parents: ["a"], message: "f", author: "tidy" })
      .commit("b", { parents: ["a"], message: "b" })
      .commit("m", { parents: ["b", "f"], message: "merge" })
      .branch("main", "m")
      .worktree("player", { branch: "main" });
    const layout = layoutRepo(b.build());
    const fStop = layout.stops.find((s) => s.oid === b.oid("f"))!;
    expect(fStop.lost).toBe(false);
    expect(layout.lanes.find((l) => l.id === fStop.laneId)).toMatchObject({ kind: "merged", owner: "tidy", row: -1 });
  });

  it("reuses a row once an earlier line has ended", () => {
    const b = new RepoBuilder()
      .commit("a", { message: "a" })
      .commit("x1", { parents: ["a"], message: "x1", author: "tidy" })
      .commit("m1", { parents: ["a", "x1"], message: "merge x" })
      .commit("m2", { parents: ["m1"], message: "m2" })
      .commit("m3", { parents: ["m2"], message: "m3" })
      .commit("m4", { parents: ["m3"], message: "m4" })
      .commit("y1", { parents: ["m4"], message: "y1", author: "blaze" })
      .branch("main", "m4", 0)
      .branch("y", "y1", 9);
    const layout = layoutRepo(b.build());
    expect(layout.lanes.find((l) => l.name === "y")!.row).toBe(-1);
    expect(layout.lanes.find((l) => l.kind === "merged")!.row).toBe(-1);
  });

  it("drops lost commits to a ghost row below everything, in their old columns", () => {
    const before = layoutRepo(forcePush.scenes[0].before);
    const after = layoutRepo(forcePush.scenes[0].after);
    const lost = after.stops.filter((s) => s.lost);
    expect(lost.map((s) => s.message)).toEqual(["Search: highlight matches", "Search: keyboard shortcuts"]);
    expect(after.ghostRow).toBe(after.maxRow + 1);
    expect(lost.every((s) => s.row === after.ghostRow)).toBe(true);
    const beforeCols = byOid(before.stops);
    for (const s of lost) expect(s.col).toBe(beforeCols.get(s.oid)!.col);
    // The edges into lost commits are marked lost as well.
    expect(after.edges.filter((e) => e.lost).map((e) => e.to).sort()).toEqual(lost.map((s) => s.oid).sort());
    // Recovery lifts them back.
    const recovered = layoutRepo(forcePush.scenes[1].after);
    expect(recovered.stops.some((s) => s.lost)).toBe(false);
    expect(recovered.ghostRow).toBeNull();
  });

  it("splits a remote tag when the server and the local view disagree", () => {
    const b = new RepoBuilder()
      .commit("a", { message: "a" })
      .commit("b", { parents: ["a"], message: "b" })
      .branch("main", "b")
      .remote("main", "b")
      .tracking("origin/main", "a");
    const tags = layoutRepo(b.build()).remoteTags;
    expect(tags.map((t) => [t.ref, t.source, t.col])).toEqual([["origin/main", "remote", 1], ["origin/main", "tracking", 0]]);
  });

  it("counts stash, remote-tracking refs and detached heads as reachable", () => {
    const b = new RepoBuilder()
      .commit("a", { message: "a" })
      .commit("s", { parents: ["a"], message: "only on a remote" })
      .commit("d", { parents: ["a"], message: "only a detached head" })
      .commit("w", { parents: ["a"], message: "only the stash base" })
      .commit("gone", { parents: ["a"], message: "nothing" })
      .branch("main", "a")
      .tracking("origin/feature", "s")
      .worktree("blaze", { detached: "d" })
      .stash("st", "w", "WIP on main");
    const state = b.build();
    const r = reachability(state);
    expect([...r.lost]).toEqual([b.oid("gone")]);
    expect([...r.hidden]).toEqual([b.oid("st")]);
    const layout = layoutRepo(state);
    expect(layout.stops.find((s) => s.oid === b.oid("st"))).toBeUndefined();
    expect(layout.stashes).toEqual([expect.objectContaining({ ref: "stash@{0}", base: b.oid("w") })]);
    expect(layout.heads[0]).toMatchObject({ actor: "blaze", detached: true, branch: null });
    const kinds = new Set(layout.lanes.map((l) => l.kind));
    expect(kinds).toEqual(new Set(["main", "remote", "detached", "stash", "ghost"]));
  });

  it("stacks robots that share a stop into slots", () => {
    const layout = layoutRepo(busy.state);
    const onMain = layout.heads.filter((h) => h.branch === "main");
    expect(onMain.map((h) => [h.actor, h.slot, h.slots])).toEqual([["player", 0, 2], ["hoarder", 1, 2]]);
  });

  it("lays out a busy history of about 60 commits without overlaps", () => {
    const layout = layoutRepo(busy.state);
    expect(layout.columns).toBeGreaterThanOrEqual(55);
    const seen = new Set(layout.stops.map((s) => `${s.col}:${s.row}`));
    expect(seen.size).toBe(layout.stops.length);
    const lanesByRow = new Map<number, [number, number][]>();
    for (const l of layout.lanes) {
      const spans = lanesByRow.get(l.row) ?? [];
      for (const [s, e] of spans) expect(l.end < s || l.start > e).toBe(true);
      spans.push([l.start, l.end]);
      lanesByRow.set(l.row, spans);
    }
    expect(layout.newest).toBe(busy.state.branches.main);
  });

  it("flags conflicted worktrees on their head marker", () => {
    const layout = layoutRepo(crew.scenes[1].after);
    expect(layout.heads.find((h) => h.actor === "blaze")!.conflicted).toBe(true);
    expect(layout.heads.find((h) => h.actor === "tidy")!.conflicted).toBe(false);
  });

  it("handles an empty repository", () => {
    const layout = layoutRepo(new RepoBuilder().worktree("player", { branch: "main" }).build());
    expect(layout).toMatchObject({ columns: 0, stops: [], edges: [], heads: [], newest: null, ghostRow: null });
  });
});

describe("topoOrder", () => {
  it("never places a child before its parent, even when clocks disagree", () => {
    const b = new RepoBuilder().commit("a", { message: "a" }).commit("b", { parents: ["a"], message: "b" });
    const state = b.build();
    state.commits[b.oid("a")].time = 99;
    expect(topoOrder(state.commits, new Set(Object.keys(state.commits)))).toEqual([b.oid("a"), b.oid("b")]);
  });
});
