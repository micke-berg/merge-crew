// Pure layout for the history map: RepoState in, grid positions out. No React, no pixels.
//
// Columns: one per drawn commit, in topological order (parents first), ties broken by commit.time.
// Rows: the trunk (main) is row 0. Every other line gets its own row, tried in the order
// -1, +1, -2, +2 ... so lines stack above and below main by creation order. A row is reused
// once an earlier line on it has ended, which keeps long histories compact.
// Lost commits (reachable from nothing) sit on a ghost row below everything, in their old column.

import { queries } from "@/engine";
import type { ActorId, Commit, Oid, RepoState } from "@/engine/types";
import { ACTOR_ORDER } from "@/lib/palette";

export type LaneKind = "main" | "branch" | "remote" | "detached" | "merged" | "stash" | "ghost";

export type Lane = {
  id: string;
  row: number;
  kind: LaneKind;
  /** Branch or ref name shown at the line end; null for anonymous lanes. */
  name: string | null;
  /** Whose colour the line takes. null means the neutral trunk or ghost colour. */
  owner: ActorId | null;
  /** First column the line occupies (the fork point if it has one). */
  start: number;
  /** Last column the line occupies (a merge target if it merges back). */
  end: number;
  /** The newest commit on the lane, or null for the ghost lane. */
  tip: Oid | null;
};

export type Stop = {
  oid: Oid;
  short: string;
  col: number;
  row: number;
  laneId: string;
  message: string;
  author: ActorId;
  time: number;
  lost: boolean;
  merge: boolean;
};

export type EdgeKind = "straight" | "fork" | "merge";

export type Edge = {
  id: string;
  from: Oid;
  to: Oid;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  kind: EdgeKind;
  parentIndex: number;
  /** The lane whose colour the edge takes. */
  laneId: string;
  lost: boolean;
};

export type BranchLabel = {
  name: string;
  oid: Oid;
  col: number;
  row: number;
  /** True when the branch owns the lane and points at its tip: label drawn at the line end. Otherwise a tag on the stop. */
  atLineEnd: boolean;
  laneId: string;
  checkedOutBy: ActorId[];
};

export type RemoteTag = {
  ref: string;
  oid: Oid;
  col: number;
  row: number;
  /** "both": server and local view agree. "remote": what the server has. "tracking": the local view, now stale. */
  source: "both" | "remote" | "tracking";
};

export type HeadMarker = {
  actor: ActorId;
  oid: Oid;
  col: number;
  row: number;
  branch: string | null;
  detached: boolean;
  /** Position among the markers that share this stop, 0-based, and how many share it. */
  slot: number;
  slots: number;
  conflicted: boolean;
};

export type StashMarker = { ref: string; oid: Oid; base: Oid; col: number; row: number };

export type MapLayout = {
  columns: number;
  minRow: number;
  maxRow: number;
  /** Row of the ghost lane, or null when nothing is lost. Always below maxRow. */
  ghostRow: number | null;
  lanes: Lane[];
  stops: Stop[];
  edges: Edge[];
  branchLabels: BranchLabel[];
  remoteTags: RemoteTag[];
  heads: HeadMarker[];
  stashes: StashMarker[];
  /** The newest drawn commit that is not lost, for auto-follow. */
  newest: Oid | null;
};

/** Columns kept free after a named line's tip so its end label has room. */
export const LABEL_COLUMNS = 2;
export const GHOST_LANE_ID = "ghost";

// ---------------------------------------------------------------------------
// Reachability
// ---------------------------------------------------------------------------

export type Reachability = {
  /** Lost commits: they exist but nothing reaches them (see queries.lost). */
  lost: Set<Oid>;
  /** Stash commits and their index commits: kept alive by the stash, but not drawn as stops. */
  hidden: Set<Oid>;
};

/** The commit a stash entry was made on. */
function stashBase(state: RepoState, entry: RepoState["stash"][number]): Oid {
  return state.commits[entry.oid]?.parents[0] ?? entry.base;
}

/**
 * Which commits the map leaves out. The engine decides what is reachable and what is lost; the map
 * only adds that the stash's own bookkeeping commits are not history worth drawing. The stash's
 * base line is real history, so it stays.
 */
export function reachability(state: RepoState): Reachability {
  const reachable = queries.reachable(state);
  const withoutStashCommits = queries.reachable({
    ...state,
    stash: state.stash.map((entry) => ({ ...entry, oid: stashBase(state, entry) })),
  });
  const hidden = new Set([...reachable].filter((oid) => !withoutStashCommits.has(oid)));
  return { lost: new Set(queries.lost(state)), hidden };
}

function headOf(state: RepoState, actor: ActorId): Oid | null {
  return queries.resolve(state, actor, "HEAD");
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

function compareCommits(a: Commit, b: Commit): number {
  return a.time - b.time || (a.oid < b.oid ? -1 : a.oid > b.oid ? 1 : 0);
}

/** Parents before children; among commits that are ready, the oldest (by time, then oid) first. */
export function topoOrder(commits: Record<Oid, Commit>, drawn: Set<Oid>): Oid[] {
  const pending = new Map<Oid, number>();
  const children = new Map<Oid, Oid[]>();
  for (const oid of drawn) {
    const ps = commits[oid].parents.filter((p) => drawn.has(p));
    pending.set(oid, new Set(ps).size);
    for (const p of new Set(ps)) {
      if (!children.has(p)) children.set(p, []);
      children.get(p)!.push(oid);
    }
  }
  const ready: Commit[] = [];
  for (const [oid, n] of pending) if (n === 0) ready.push(commits[oid]);
  const out: Oid[] = [];
  while (ready.length) {
    ready.sort(compareCommits);
    const c = ready.shift()!;
    out.push(c.oid);
    for (const child of children.get(c.oid) ?? []) {
      const n = pending.get(child)! - 1;
      pending.set(child, n);
      if (n === 0) ready.push(commits[child]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Names and owners
// ---------------------------------------------------------------------------

function trunkName(state: RepoState): string | null {
  if (state.branches.main) return "main";
  if (state.branches.master) return "master";
  return null;
}

/** When a branch was created: its oldest reflog time, else its tip's time. */
function branchBirth(state: RepoState, name: string): number {
  const log = state.branchReflogs[name];
  if (log && log.length) return Math.min(...log.map((e) => e.time));
  return state.commits[state.branches[name]]?.time ?? 0;
}

function byBirth(state: RepoState) {
  return (a: string, b: string) => branchBirth(state, a) - branchBirth(state, b) || (a < b ? -1 : 1);
}

function actorRank(actor: ActorId): number {
  const i = ACTOR_ORDER.indexOf(actor);
  return i === -1 ? ACTOR_ORDER.length : i;
}

export function sortActors(actors: ActorId[]): ActorId[] {
  return [...actors].sort((a, b) => actorRank(a) - actorRank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

function checkedOutBy(state: RepoState): Map<string, ActorId[]> {
  const m = new Map<string, ActorId[]>();
  for (const actor of sortActors(Object.keys(state.worktrees))) {
    const head = state.worktrees[actor].head;
    if (head.kind !== "branch") continue;
    if (!m.has(head.name)) m.set(head.name, []);
    m.get(head.name)!.push(actor);
  }
  return m;
}

/** What each remote has, keyed like "origin/main". */
function serverRefs(state: RepoState): Map<string, Oid> {
  const refs = new Map<string, Oid>();
  for (const [rname, remote] of Object.entries(state.remotes).sort()) {
    for (const [b, oid] of Object.entries(remote.branches).sort()) refs.set(`${rname}/${b}`, oid);
  }
  return new Map([...refs].sort());
}

// ---------------------------------------------------------------------------
// Layout, step by step
// ---------------------------------------------------------------------------

/** What every step reads: the commits to draw, their order and columns. */
type Grid = {
  state: RepoState;
  commits: Record<Oid, Commit>;
  drawn: Set<Oid>;
  lost: Set<Oid>;
  order: Oid[];
  col: Map<Oid, number>;
  /** Children of each commit, with which parent slot they use. */
  children: Map<Oid, { oid: Oid; index: number }[]>;
  owners: Map<string, ActorId[]>;
  trunk: string | null;
  server: Map<string, Oid>;
};

function buildGrid(state: RepoState): Grid {
  const { commits } = state;
  const { lost, hidden } = reachability(state);
  const drawn = new Set(Object.keys(commits).filter((o) => !hidden.has(o)));
  const order = topoOrder(commits, drawn);
  const children = new Map<Oid, { oid: Oid; index: number }[]>();
  for (const oid of order) {
    commits[oid].parents.forEach((p, index) => {
      if (!drawn.has(p)) return;
      if (!children.has(p)) children.set(p, []);
      children.get(p)!.push({ oid, index });
    });
  }
  return {
    state, commits, drawn, lost, order, children,
    col: new Map(order.map((oid, i) => [oid, i])),
    owners: checkedOutBy(state),
    trunk: trunkName(state),
    server: serverRefs(state),
  };
}

type Tip = { oid: Oid; kind: Exclude<LaneKind, "ghost" | "main">; name: string | null; owner: ActorId | null };

/** The order in which lines claim their commits: local branches by age, remotes, detached heads, stashes. */
function lineTips(grid: Grid): Tip[] {
  const { state, commits, owners, trunk, server } = grid;
  const tips: Tip[] = [];
  for (const name of Object.keys(state.branches).filter((n) => n !== trunk).sort(byBirth(state))) {
    const oid = state.branches[name];
    tips.push({ oid, kind: "branch", name, owner: owners.get(name)?.[0] ?? commits[oid]?.author ?? null });
  }
  for (const [ref, oid] of server) tips.push({ oid, kind: "remote", name: ref, owner: commits[oid]?.author ?? null });
  for (const [ref, oid] of Object.entries(state.remoteTracking).sort()) {
    if (server.get(ref) === oid) continue;
    tips.push({ oid, kind: "remote", name: ref, owner: commits[oid]?.author ?? null });
  }
  for (const actor of sortActors(Object.keys(state.worktrees))) {
    const head = state.worktrees[actor].head;
    if (head.kind === "detached") tips.push({ oid: head.oid, kind: "detached", name: null, owner: actor });
  }
  for (const entry of state.stash) tips.push({ oid: stashBase(state, entry), kind: "stash", name: null, owner: null });
  return tips;
}

/**
 * Give every drawn, live commit a lane. Each line claims commits along its first-parent chain until
 * it meets one already claimed, then takes the nearest free row (-1, +1, -2, +2 ...).
 */
function assignLanes(grid: Grid): { lanes: Lane[]; laneOf: Map<Oid, string> } {
  const { state, commits, drawn, lost, order, col, children, trunk } = grid;
  const laneOf = new Map<Oid, string>();
  const lanes: Lane[] = [];
  const occupied = new Map<number, [number, number][]>();

  const claim = (tip: Oid): Oid[] => {
    const chain: Oid[] = [];
    let cur: Oid | undefined = tip;
    while (cur && drawn.has(cur) && !lost.has(cur) && !laneOf.has(cur)) {
      chain.push(cur);
      cur = commits[cur].parents[0];
    }
    return chain; // newest first
  };

  const fits = (row: number, s: number, e: number) =>
    (occupied.get(row) ?? []).every(([a, b]) => e < a - 0.5 || s > b + 0.5);

  const freeRow = (s: number, e: number): number => {
    for (let k = 1; ; k++) {
      if (fits(-k, s, e)) return -k;
      if (fits(k, s, e)) return k;
    }
  };

  const addLane = (chain: Oid[], kind: LaneKind, name: string | null, owner: ActorId | null, forceRow?: number) => {
    const oldest = chain[chain.length - 1];
    const tip = chain[0];
    const forkParent = commits[oldest].parents[0];
    const start = forkParent !== undefined && col.has(forkParent) ? col.get(forkParent)! : col.get(oldest)!;
    let end = col.get(tip)!;
    for (const child of children.get(tip) ?? []) {
      if (child.index > 0 && !lost.has(child.oid)) end = Math.max(end, col.get(child.oid)!);
    }
    const reserveEnd = name ? end + LABEL_COLUMNS : end;
    const row = forceRow ?? freeRow(start, reserveEnd);
    if (!occupied.has(row)) occupied.set(row, []);
    occupied.get(row)!.push([start, reserveEnd]);
    const id = `${kind}:${name ?? tip}`;
    lanes.push({ id, row, kind, name, owner, start, end, tip });
    for (const oid of chain) laneOf.set(oid, id);
  };

  if (trunk) {
    const chain = claim(state.branches[trunk]);
    if (chain.length) addLane(chain, "main", trunk, null, 0);
  }
  // Without a trunk, the first line to claim anything becomes row 0.
  for (const t of lineTips(grid)) {
    const chain = claim(t.oid);
    if (chain.length) addLane(chain, t.kind, t.name, t.owner, lanes.length === 0 ? 0 : undefined);
  }
  // Commits only reachable through merges: the branch that made them was deleted.
  for (let i = order.length - 1; i >= 0; i--) {
    const oid = order[i];
    if (laneOf.has(oid) || lost.has(oid)) continue;
    addLane(claim(oid), "merged", null, commits[oid].author, lanes.length === 0 ? 0 : undefined);
  }
  return { lanes, laneOf };
}

/** Lost commits sit on one ghost lane below everything, in their old columns. */
function addGhostLane(grid: Grid, lanes: Lane[], laneOf: Map<Oid, string>): number | null {
  const lostOids = grid.order.filter((o) => grid.lost.has(o));
  if (!lostOids.length) return null;
  const row = Math.max(0, ...lanes.map((l) => l.row)) + 1;
  const cols = lostOids.map((o) => grid.col.get(o)!);
  lanes.push({
    id: GHOST_LANE_ID, row, kind: "ghost", name: null, owner: null,
    start: Math.min(...cols), end: Math.max(...cols), tip: null,
  });
  for (const oid of lostOids) laneOf.set(oid, GHOST_LANE_ID);
  return row;
}

type Placed = Grid & { laneOf: Map<Oid, string>; laneById: Map<string, Lane>; rowOf: (oid: Oid) => number };

function buildStops({ order, commits, col, drawn, lost, laneOf, rowOf }: Placed): Stop[] {
  return order.map((oid) => {
    const c = commits[oid];
    return {
      oid, short: oid.slice(0, 7), col: col.get(oid)!, row: rowOf(oid), laneId: laneOf.get(oid)!,
      message: c.message, author: c.author, time: c.time, lost: lost.has(oid),
      merge: c.parents.filter((p) => drawn.has(p)).length > 1,
    };
  });
}

function buildEdges({ order, commits, col, drawn, lost, laneOf, rowOf }: Placed): Edge[] {
  const edges: Edge[] = [];
  for (const oid of order) {
    commits[oid].parents.forEach((p, parentIndex) => {
      if (!drawn.has(p)) return;
      const fromRow = rowOf(p);
      const toRow = rowOf(oid);
      const kind: EdgeKind = fromRow === toRow ? "straight" : parentIndex === 0 ? "fork" : "merge";
      edges.push({
        id: `${p}>${oid}`, from: p, to: oid,
        fromCol: col.get(p)!, fromRow, toCol: col.get(oid)!, toRow, kind, parentIndex,
        laneId: kind === "merge" ? laneOf.get(p)! : laneOf.get(oid)!,
        lost: lost.has(oid),
      });
    });
  }
  return edges;
}

function buildBranchLabels({ state, trunk, col, laneOf, laneById, owners }: Placed): BranchLabel[] {
  const birth = byBirth(state);
  return Object.keys(state.branches)
    .sort((a, b) => (a === trunk ? -1 : b === trunk ? 1 : birth(a, b)))
    .filter((name) => col.has(state.branches[name]))
    .map((name) => {
      const oid = state.branches[name];
      const laneId = laneOf.get(oid)!;
      const lane = laneById.get(laneId)!;
      return {
        name, oid, col: col.get(oid)!, row: lane.row, laneId,
        atLineEnd: lane.name === name && lane.tip === oid,
        checkedOutBy: owners.get(name) ?? [],
      };
    });
}

function buildRemoteTags({ state, server, col, rowOf }: Placed): RemoteTag[] {
  const tags: RemoteTag[] = [];
  const refs = new Set([...server.keys(), ...Object.keys(state.remoteTracking)]);
  for (const ref of [...refs].sort()) {
    const onServer = server.get(ref);
    const local = state.remoteTracking[ref];
    const push = (oid: Oid, source: RemoteTag["source"]) => {
      if (col.has(oid)) tags.push({ ref, oid, col: col.get(oid)!, row: rowOf(oid), source });
    };
    if (onServer && onServer === local) push(onServer, "both");
    else {
      if (onServer) push(onServer, "remote");
      if (local) push(local, "tracking");
    }
  }
  return tags;
}

function buildHeads({ state, col, rowOf }: Placed): HeadMarker[] {
  const heads: HeadMarker[] = [];
  const perStop = new Map<Oid, number>();
  for (const actor of sortActors(Object.keys(state.worktrees))) {
    const wt = state.worktrees[actor];
    const oid = headOf(state, actor);
    if (!oid || !col.has(oid)) continue;
    const slot = perStop.get(oid) ?? 0;
    perStop.set(oid, slot + 1);
    heads.push({
      actor, oid, col: col.get(oid)!, row: rowOf(oid),
      branch: wt.head.kind === "branch" ? wt.head.name : null,
      detached: wt.head.kind === "detached", slot, slots: 0,
      conflicted: Object.keys(wt.conflicts).length > 0,
    });
  }
  for (const h of heads) h.slots = perStop.get(h.oid)!;
  return heads;
}

function buildStashes({ state, col, rowOf }: Placed): StashMarker[] {
  const stashes: StashMarker[] = [];
  state.stash.forEach((entry, i) => {
    const base = stashBase(state, entry);
    if (col.has(base)) stashes.push({ ref: `stash@{${i}}`, oid: entry.oid, base, col: col.get(base)!, row: rowOf(base) });
  });
  return stashes;
}

export function layoutRepo(state: RepoState): MapLayout {
  const grid = buildGrid(state);
  const { lanes, laneOf } = assignLanes(grid);
  const live = lanes.map((l) => l.row);
  const minRow = live.length ? Math.min(...live) : 0;
  const maxRow = live.length ? Math.max(...live) : 0;
  const ghostRow = addGhostLane(grid, lanes, laneOf);
  const laneById = new Map(lanes.map((l) => [l.id, l]));
  const placed: Placed = { ...grid, laneOf, laneById, rowOf: (oid) => laneById.get(laneOf.get(oid)!)!.row };
  const liveOrder = grid.order.filter((o) => !grid.lost.has(o));
  return {
    columns: grid.order.length, minRow, maxRow, ghostRow, lanes,
    stops: buildStops(placed),
    edges: buildEdges(placed),
    branchLabels: buildBranchLabels(placed),
    remoteTags: buildRemoteTags(placed),
    heads: buildHeads(placed),
    stashes: buildStashes(placed),
    newest: liveOrder.length ? liveOrder[liveOrder.length - 1] : null,
  };
}
