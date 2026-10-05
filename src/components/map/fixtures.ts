// Hand-built repository states for the map showcase and the layout tests.
// The engine is not used here: every state is assembled directly, with fake but plausible oids.

import type {
  ActorId, Commit, EngineEvent, FileTree, HeadRef, Mood, Oid, ReflogEntry, RepoState, StashEntry, Worktree,
} from "@/engine/types";

/** A deterministic 40-hex oid from a seed string (FNV-1a, run five times with different salts). */
export function fakeOid(seed: string): Oid {
  let out = "";
  for (let salt = 0; salt < 5; salt++) {
    let h = 0x811c9dc5 ^ (salt * 0x9e3779b1);
    for (const ch of `${salt}:${seed}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}

type CommitSpec = { parents?: string[]; message: string; author?: ActorId; files?: FileTree };

/** Builds a RepoState from short commit names. Each commit gets the next clock tick as its time. */
export class RepoBuilder {
  private commits: Record<Oid, Commit> = {};
  private branches: Record<string, Oid> = {};
  private branchReflogs: Record<string, ReflogEntry[]> = {};
  private remoteBranches: Record<string, Oid> = {};
  private remoteTracking: Record<string, Oid> = {};
  private worktrees: Record<ActorId, Worktree> = {};
  private stashEntries: StashEntry[] = [];
  private clock = 0;
  private names = new Map<string, Oid>();

  oid(name: string): Oid {
    const oid = this.names.get(name);
    if (!oid) throw new Error(`unknown commit ${name}`);
    return oid;
  }

  commit(name: string, spec: CommitSpec): this {
    const oid = fakeOid(`commit:${name}`);
    const parents = (spec.parents ?? []).map((p) => this.oid(p));
    const parentTree = parents[0] ? this.commits[parents[0]].tree : {};
    this.clock += 1;
    this.commits[oid] = {
      oid, parents, message: spec.message, author: spec.author ?? "player", time: this.clock,
      tree: spec.files ?? { ...parentTree, [`notes/${name}.txt`]: `${spec.message}\n` },
    };
    this.names.set(name, oid);
    return this;
  }

  /** A run of commits on top of `from`, named prefix1..prefixN. */
  chain(prefix: string, from: string | null, count: number, author: ActorId, messages: string[]): this {
    let parent = from;
    for (let i = 1; i <= count; i++) {
      const name = `${prefix}${i}`;
      this.commit(name, { parents: parent ? [parent] : [], message: messages[(i - 1) % messages.length], author });
      parent = name;
    }
    return this;
  }

  branch(name: string, commit: string, bornAt?: number): this {
    const oid = this.oid(commit);
    this.branches[name] = oid;
    const time = bornAt ?? this.commits[oid].time;
    this.branchReflogs[name] = [{ oid, previous: null, message: `branch: Created from ${commit}`, time }];
    return this;
  }

  deleteBranch(name: string): this {
    delete this.branches[name];
    delete this.branchReflogs[name];
    return this;
  }

  remote(branch: string, commit: string): this {
    this.remoteBranches[branch] = this.oid(commit);
    return this;
  }

  tracking(ref: string, commit: string): this {
    this.remoteTracking[ref] = this.oid(commit);
    return this;
  }

  /** Push semantics: the server and the local view agree. */
  pushed(branch: string, commit: string): this {
    return this.remote(branch, commit).tracking(`origin/${branch}`, commit);
  }

  worktree(actor: ActorId, head: { branch: string } | { detached: string }, conflicts: string[] = []): this {
    const headRef: HeadRef = "branch" in head ? { kind: "branch", name: head.branch } : { kind: "detached", oid: this.oid(head.detached) };
    const headOid = headRef.kind === "branch" ? this.branches[headRef.name] : headRef.oid;
    const tree = headOid ? this.commits[headOid].tree : {};
    this.worktrees[actor] = {
      actor, path: actor === "player" ? "/repo" : `/crew/${actor}`, head: headRef,
      index: tree, workingTree: tree, headReflog: [], inProgress: null,
      conflicts: Object.fromEntries(conflicts.map((p) => [p, { base: "a\n", ours: "b\n", theirs: "c\n" }])),
    };
    return this;
  }

  stash(name: string, base: string, message: string): this {
    this.commit(name, { parents: [base], message, author: "hoarder" });
    const oid = this.oid(name);
    this.stashEntries.unshift({ oid, message, base: this.oid(base), index: {}, workingTree: this.commits[oid].tree });
    return this;
  }

  build(): RepoState {
    return structuredClone({
      commits: this.commits,
      branches: this.branches,
      branchReflogs: this.branchReflogs,
      upstreams: Object.fromEntries(Object.keys(this.branches).map((b) => [b, { remote: "origin", branch: b }])),
      remoteTracking: this.remoteTracking,
      remotes: { origin: { name: "origin", branches: this.remoteBranches } },
      worktrees: this.worktrees,
      stash: this.stashEntries,
      clock: this.clock,
    });
  }
}

// ---------------------------------------------------------------------------
// Scenes: a state before, a state after, and the events between them
// ---------------------------------------------------------------------------

export type Scene = {
  id: string;
  label: string;
  before: RepoState;
  after: RepoState;
  events: EngineEvent[];
  /** Moods to show once the scene has played. */
  moods?: Partial<Record<ActorId, Mood>>;
};
export type Fixture = { id: string; title: string; blurb: string; state: RepoState; scenes: Scene[] };

const o = fakeOid;
const C = (name: string) => o(`commit:${name}`);

// --- 1. Linear history ------------------------------------------------------

function linearBase(): RepoBuilder {
  return new RepoBuilder()
    .commit("l1", { message: "Initial commit", author: "player" })
    .commit("l2", { parents: ["l1"], message: "Add README", author: "player" })
    .commit("l3", { parents: ["l2"], message: "Add login form", author: "tidy" });
}

const linearBefore = linearBase().branch("main", "l3", 0).pushed("main", "l2").worktree("player", { branch: "main" }).build();
const linearAfter = linearBase()
  .commit("l4", { parents: ["l3"], message: "Validate email field", author: "player" })
  .branch("main", "l4", 0).pushed("main", "l2").worktree("player", { branch: "main" }).build();

export const linear: Fixture = {
  id: "linear",
  title: "Linear history",
  blurb: "One line, three stops, the player on main.",
  state: linearBefore,
  scenes: [{
    id: "commit",
    label: "Player commits",
    before: linearBefore,
    after: linearAfter,
    events: [
      { type: "commit-created", actor: "player", oid: C("l4"), parents: [C("l3")], branch: "main" },
      { type: "branch-moved", actor: "player", name: "main", from: C("l3"), to: C("l4"), reason: "commit" },
    ],
  }],
};

// --- 2. Three robots on branches in worktrees -------------------------------

function crewBase(): RepoBuilder {
  return new RepoBuilder()
    .commit("m1", { message: "Initial commit", author: "player" })
    .commit("m2", { parents: ["m1"], message: "Add app shell", author: "player" })
    .commit("m3", { parents: ["m2"], message: "Add router", author: "tidy" })
    .commit("t1", { parents: ["m3"], message: "Write docs for router", author: "tidy" })
    .commit("b1", { parents: ["m3"], message: "Rewrite everything in one go", author: "blaze" })
    .commit("m4", { parents: ["m3"], message: "Fix header spacing", author: "player" })
    .commit("d1", { parents: ["m2"], message: "Explore dark theme idea", author: "drift" })
    .commit("t2", { parents: ["t1"], message: "Docs: add examples", author: "tidy" })
    .commit("b2", { parents: ["b1"], message: "Speed up build (maybe)", author: "blaze" })
    .commit("d2", { parents: ["d1"], message: "Dark theme, round two", author: "drift" });
}

function crewRefs(b: RepoBuilder, conflicts: string[] = []): RepoBuilder {
  return b
    .branch("main", "m4", 1)
    .branch("docs", "t2", 3)
    .branch("blaze/turbo", "b2", 4)
    .branch("drift/dark-theme", "d2", 6)
    .pushed("main", "m4")
    .worktree("player", { branch: "main" })
    .worktree("tidy", { branch: "docs" })
    .worktree("blaze", { branch: "blaze/turbo" }, conflicts)
    .worktree("drift", { branch: "drift/dark-theme" });
}

const crewBefore = crewRefs(crewBase()).build();
const crewAfterCommit = (() => {
  const b = crewBase()
    .commit("b3", { parents: ["b2"], message: "Delete the slow tests", author: "blaze" })
    .commit("d3", { parents: ["d2"], message: "Wander: add a parallax sky", author: "drift" });
  return crewRefs(b).branch("blaze/turbo", "b3", 4).branch("drift/dark-theme", "d3", 6).build();
})();
const crewConflict = crewRefs(crewBase(), ["src/app.ts"]).build();

export const crew: Fixture = {
  id: "crew",
  title: "Crew in worktrees",
  blurb: "Tidy, Blaze and Drift each on their own branch and worktree. Drift forked early and never came back.",
  state: crewBefore,
  scenes: [
    {
      id: "commits",
      label: "Blaze and Drift commit",
      before: crewBefore,
      after: crewAfterCommit,
      events: [
        { type: "commit-created", actor: "blaze", oid: C("b3"), parents: [C("b2")], branch: "blaze/turbo" },
        { type: "branch-moved", actor: "blaze", name: "blaze/turbo", from: C("b2"), to: C("b3"), reason: "commit" },
        { type: "commit-created", actor: "drift", oid: C("d3"), parents: [C("d2")], branch: "drift/dark-theme" },
        { type: "branch-moved", actor: "drift", name: "drift/dark-theme", from: C("d2"), to: C("d3"), reason: "commit" },
      ],
    },
    {
      id: "conflict",
      label: "Blaze hits a conflict",
      before: crewBefore,
      after: crewConflict,
      events: [
        { type: "operation", actor: "blaze", kind: "merge", phase: "started" },
        { type: "conflict", actor: "blaze", paths: ["src/app.ts"] },
        { type: "operation", actor: "blaze", kind: "merge", phase: "stopped" },
      ],
    },
  ],
};

// --- 3. A merge --------------------------------------------------------------

function mergeBase(): RepoBuilder {
  return new RepoBuilder()
    .commit("a1", { message: "Initial commit", author: "player" })
    .commit("a2", { parents: ["a1"], message: "Add cart page", author: "player" })
    .commit("f1", { parents: ["a2"], message: "Checkout: form skeleton", author: "tidy" })
    .commit("a3", { parents: ["a2"], message: "Fix price rounding", author: "player" })
    .commit("f2", { parents: ["f1"], message: "Checkout: validation", author: "tidy" })
    .commit("f3", { parents: ["f2"], message: "Checkout: tests", author: "tidy" });
}

const mergeBefore = mergeBase()
  .branch("main", "a3", 1).branch("checkout", "f3", 2).pushed("main", "a3")
  .worktree("player", { branch: "main" }).worktree("tidy", { branch: "checkout" }).build();
const mergeAfter = mergeBase()
  .commit("mg", { parents: ["a3", "f3"], message: "Merge branch 'checkout'", author: "player" })
  .branch("main", "mg", 1).branch("checkout", "f3", 2).pushed("main", "a3")
  .worktree("player", { branch: "main" }).worktree("tidy", { branch: "checkout" }).build();

export const merge: Fixture = {
  id: "merge",
  title: "A merge",
  blurb: "Tidy's checkout branch joins main with a merge commit.",
  state: mergeBefore,
  scenes: [{
    id: "merge",
    label: "Merge checkout into main",
    before: mergeBefore,
    after: mergeAfter,
    events: [
      { type: "operation", actor: "player", kind: "merge", phase: "started" },
      { type: "commit-created", actor: "player", oid: C("mg"), parents: [C("a3"), C("f3")], branch: "main" },
      { type: "branch-moved", actor: "player", name: "main", from: C("a3"), to: C("mg"), reason: "merge" },
      { type: "operation", actor: "player", kind: "merge", phase: "completed" },
    ],
  }],
};

// --- 4. Forced push that loses two commits on origin -------------------------

function forceBase(): RepoBuilder {
  return new RepoBuilder()
    .commit("p1", { message: "Initial commit", author: "player" })
    .commit("p2", { parents: ["p1"], message: "Add search box", author: "player" })
    .commit("p3", { parents: ["p2"], message: "Search: debounce input", author: "player" })
    .commit("k1", { parents: ["p3"], message: "Search: highlight matches", author: "tidy" })
    .commit("k2", { parents: ["k1"], message: "Search: keyboard shortcuts", author: "tidy" })
    .commit("z1", { parents: ["p3"], message: "YOLO search rewrite", author: "blaze" });
}

/** Everyone sees origin/main at Tidy's work; Blaze's local main has diverged. */
const forceBefore = forceBase()
  .branch("main", "k2", 1).branch("blaze/main", "z1", 6).pushed("main", "k2")
  .worktree("player", { branch: "main" }).worktree("tidy", { detached: "k2" }).worktree("blaze", { branch: "blaze/main" })
  .build();

/** Blaze force-pushes his main over origin/main. Main is reset to match, Tidy's commits are gone from every ref. */
const forceAfter = forceBase()
  .branch("main", "z1", 1).branch("blaze/main", "z1", 6).pushed("main", "z1")
  .worktree("player", { branch: "main" }).worktree("tidy", { detached: "z1" }).worktree("blaze", { branch: "blaze/main" })
  .build();

/** The player finds k2 in the reflog and puts it on a rescue branch. */
const forceRecovered = forceBase()
  .branch("main", "z1", 1).branch("blaze/main", "z1", 6).branch("rescue", "k2", 8).pushed("main", "z1")
  .worktree("player", { branch: "rescue" }).worktree("tidy", { detached: "z1" }).worktree("blaze", { branch: "blaze/main" })
  .build();

export const forcePush: Fixture = {
  id: "force-push",
  title: "Forced push",
  blurb: "Blaze force-pushes over origin/main. Tidy's two commits fall to the ghost lane; the reflog lifts them back.",
  state: forceBefore,
  scenes: [
    {
      id: "force",
      label: "Blaze force-pushes",
      before: forceBefore,
      after: forceAfter,
      moods: { blaze: "happy", tidy: "scared", player: "thinking" },
      events: [
        { type: "remote-updated", actor: "blaze", remote: "origin", branch: "main", from: C("k2"), to: C("z1"), forced: true },
        { type: "remote-tracking-updated", actor: "blaze", ref: "origin/main", from: C("k2"), to: C("z1") },
        { type: "branch-moved", actor: "player", name: "main", from: C("k2"), to: C("z1"), reason: "reset" },
        { type: "head-moved", actor: "tidy", from: { kind: "detached", oid: C("k2") }, to: { kind: "detached", oid: C("z1") } },
        { type: "commits-lost", oids: [C("k1"), C("k2")] },
      ],
    },
    {
      id: "recover",
      label: "Recover from the reflog",
      before: forceAfter,
      after: forceRecovered,
      moods: { blaze: "guilty", tidy: "happy", player: "celebrate" },
      events: [
        { type: "branch-created", actor: "player", name: "rescue", oid: C("k2") },
        { type: "commits-recovered", oids: [C("k1"), C("k2")] },
        { type: "head-moved", actor: "player", from: { kind: "branch", name: "main" }, to: { kind: "branch", name: "rescue" } },
      ],
    },
  ],
};

// --- 5. A busy history, to check density ------------------------------------

function busyBase(extra: number): RepoBuilder {
  const msgs = ["Tweak copy", "Fix typo", "Refactor helper", "Add test", "Bump version", "Tidy imports"];
  const b = new RepoBuilder().chain("main", null, 8, "player", ["Initial commit", ...msgs]);
  b.chain("tidyA", "main3", 4, "tidy", ["Docs: intro", "Docs: install", "Docs: usage", "Docs: faq"]);
  b.chain("mainB", "main8", 8, "player", msgs);
  b.commit("mergeA", { parents: ["mainB8", "tidyA4"], message: "Merge branch 'docs'", author: "player" });
  b.chain("blazeA", "mergeA", 5, "blaze", ["Turbo mode", "Turbo mode 2", "Skip lint", "Hotfix", "Hotfix hotfix"]);
  b.chain("driftA", "main5", 7, "drift", ["Sketch", "Daydream", "Prototype", "Wander", "Revisit", "Ponder", "Sketch more"]);
  b.chain("mainC", "mergeA", 8, "player", msgs);
  b.commit("mergeB", { parents: ["mainC8", "blazeA5"], message: "Merge branch 'turbo'", author: "player" });
  b.chain("tidyB", "mergeB", 4, "tidy", ["Polish", "Polish more", "Test edge cases", "Review fixes"]);
  b.chain("mainD", "mergeB", 10 + extra, "player", msgs);
  b.stash("stash1", "mainC4", "WIP on main: half-finished settings page");
  return b;
}

const busyState = busyBase(0)
  .branch("main", "mainD10", 1).branch("drift/sketchbook", "driftA7", 20).branch("tidy/polish", "tidyB4", 40)
  .pushed("main", "mainD7")
  .worktree("player", { branch: "main" }).worktree("tidy", { branch: "tidy/polish" })
  .worktree("drift", { branch: "drift/sketchbook" }).worktree("hoarder", { branch: "main" })
  .build();
const busyAfter = busyBase(1)
  .branch("main", "mainD11", 1).branch("drift/sketchbook", "driftA7", 20).branch("tidy/polish", "tidyB4", 40)
  .pushed("main", "mainD7")
  .worktree("player", { branch: "main" }).worktree("tidy", { branch: "tidy/polish" })
  .worktree("drift", { branch: "drift/sketchbook" }).worktree("hoarder", { branch: "main" })
  .build();

export const busy: Fixture = {
  id: "busy",
  title: "Busy history",
  blurb: "About 60 commits, two merged branches, two open ones and a forgotten stash. Checks density and scrolling.",
  state: busyState,
  scenes: [{
    id: "commit",
    label: "One more commit",
    before: busyState,
    after: busyAfter,
    events: [
      { type: "commit-created", actor: "player", oid: C("mainD11"), parents: [C("mainD10")], branch: "main" },
      { type: "branch-moved", actor: "player", name: "main", from: C("mainD10"), to: C("mainD11"), reason: "commit" },
    ],
  }],
};

export const FIXTURES: Fixture[] = [linear, crew, merge, forcePush, busy];
