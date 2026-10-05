// Revision parsing and commit-graph walks.

import { ZERO_OID } from "./objects";
import type { ActorId, Commit, Oid, ReflogEntry, RepoState, Worktree } from "./types";

export function headOid(state: RepoState, wt: Worktree): Oid | null {
  if (wt.head.kind === "detached") return wt.head.oid;
  return state.branches[wt.head.name] ?? null;
}

/** Look up a ref name the way git's ref DWIM rules do: refs/heads first, then refs/remotes. */
export function resolveRefName(state: RepoState, name: string): Oid | null {
  if (name.startsWith("refs/heads/")) return state.branches[name.slice(11)] ?? null;
  if (name.startsWith("refs/remotes/")) return state.remoteTracking[name.slice(13)] ?? null;
  if (Object.prototype.hasOwnProperty.call(state.branches, name)) return state.branches[name];
  if (Object.prototype.hasOwnProperty.call(state.remoteTracking, name)) return state.remoteTracking[name];
  if (name.startsWith("remotes/")) return state.remoteTracking[name.slice(8)] ?? null;
  return null;
}

/** If `name` names a remote-tracking ref, its "remote/branch" key. */
export function remoteTrackingKey(state: RepoState, name: string): string | null {
  if (Object.prototype.hasOwnProperty.call(state.branches, name)) return null;
  let key = name;
  if (key.startsWith("refs/remotes/")) key = key.slice(13);
  else if (key.startsWith("remotes/")) key = key.slice(8);
  return Object.prototype.hasOwnProperty.call(state.remoteTracking, key) ? key : null;
}

function nthReflog(entries: ReflogEntry[], n: number): Oid | null {
  const len = entries.length;
  let oid: Oid | null;
  if (n < len) oid = entries[len - 1 - n].oid;
  else if (n === len && len > 0) oid = entries[0].previous;
  else oid = null;
  return oid === ZERO_OID ? null : oid;
}

/** The branch or commit that `@{-n}` names: the "from" side of the n-th most recent checkout. */
export function previousCheckout(wt: Worktree, n: number): string | null {
  let seen = 0;
  for (let i = wt.headReflog.length - 1; i >= 0; i--) {
    const m = /^checkout: moving from (\S+) to (\S+)$/.exec(wt.headReflog[i].message);
    if (m) {
      seen++;
      if (seen === n) return m[1];
    }
  }
  return null;
}

function resolveBase(state: RepoState, wt: Worktree | undefined, base: string): Oid | null {
  const at = /^(.*)@\{(.+)\}$/.exec(base);
  if (at) {
    const ref = at[1];
    const sel = at[2];
    if (/^-\d+$/.test(sel)) {
      if (ref !== "" || !wt) return null;
      const prev = previousCheckout(wt, Number(sel.slice(1)));
      return prev ? resolveBase(state, wt, prev) : null;
    }
    if (sel === "u" || sel === "upstream") {
      const branch = ref === "" ? (wt?.head.kind === "branch" ? wt.head.name : null) : ref;
      const up = branch ? state.upstreams[branch] : undefined;
      if (!up) return null;
      return state.remoteTracking[`${up.remote}/${up.branch}`] ?? null;
    }
    if (!/^\d+$/.test(sel)) return null;
    const n = Number(sel);
    if ((ref === "stash" || ref === "refs/stash") && state.stash.length) return state.stash[n]?.oid ?? null;
    if (ref === "HEAD" || ref === "@") return wt ? nthReflog(wt.headReflog, n) : null;
    if (ref === "") {
      if (!wt) return null;
      if (wt.head.kind === "detached") return nthReflog(wt.headReflog, n);
      return nthReflog(state.branchReflogs[wt.head.name] ?? [], n);
    }
    const name = ref.startsWith("refs/heads/") ? ref.slice(11) : ref;
    const log = state.branchReflogs[name];
    if (log && !name.startsWith("refs/")) return nthReflog(log, n);
    // Remote-tracking refs keep their reflog under the full ref name (see trackingReflogKey).
    const key = remoteTrackingKey(state, name);
    const tracking = key ? state.branchReflogs[trackingReflogKey(key)] : undefined;
    return tracking ? nthReflog(tracking, n) : null;
  }
  if (base === "HEAD" || base === "@") return wt ? headOid(state, wt) : null;
  // refs/stash comes before refs/heads in git's lookup order.
  if ((base === "stash" || base === "refs/stash") && state.stash.length) return state.stash[0].oid;
  const byRef = resolveRefName(state, base);
  if (byRef) return byRef;
  if (/^[0-9a-f]{4,40}$/.test(base)) {
    if (base.length === 40) return state.commits[base] ? base : null;
    let found: Oid | null = null;
    for (const oid of Object.keys(state.commits)) {
      if (oid.startsWith(base)) {
        if (found) return null; // ambiguous
        found = oid;
      }
    }
    return found;
  }
  return null;
}

/** Split "main~2^2" into its base and navigation suffix. */
export function splitRev(rev: string): { base: string; suffix: string } {
  let depth = 0;
  for (let i = 0; i < rev.length; i++) {
    const ch = rev[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0 && (ch === "~" || ch === "^")) return { base: rev.slice(0, i), suffix: rev.slice(i) };
  }
  return { base: rev, suffix: "" };
}

export function resolveRev(state: RepoState, actor: ActorId, rev: string): Oid | null {
  if (!rev) return null;
  const wt = state.worktrees[actor];
  const { base, suffix } = splitRev(rev);
  let oid = resolveBase(state, wt, base === "" ? "HEAD" : base);
  const re = /([~^])(\d*)/y;
  let pos = 0;
  while (oid && pos < suffix.length) {
    re.lastIndex = pos;
    const m = re.exec(suffix);
    if (!m) return null;
    pos = re.lastIndex;
    const n = m[2] === "" ? 1 : Number(m[2]);
    if (m[1] === "~") {
      for (let i = 0; i < n && oid; i++) oid = state.commits[oid]?.parents[0] ?? null;
    } else if (n > 0) {
      oid = state.commits[oid]?.parents[n - 1] ?? null;
    }
  }
  return oid && state.commits[oid] ? oid : null;
}

export function ancestors(state: RepoState, from: Oid): Set<Oid> {
  const seen = new Set<Oid>();
  const stack = [from];
  while (stack.length) {
    const oid = stack.pop() as Oid;
    if (seen.has(oid)) continue;
    const commit = state.commits[oid];
    if (!commit) continue;
    seen.add(oid);
    for (const p of commit.parents) stack.push(p);
  }
  return seen;
}

export function isAncestor(state: RepoState, ancestor: Oid, descendant: Oid): boolean {
  return ancestors(state, descendant).has(ancestor);
}

/** Best common ancestors: common ancestors that are not ancestors of another common ancestor. */
export function mergeBases(state: RepoState, a: Oid, b: Oid): Oid[] {
  const ancA = ancestors(state, a);
  const common = [...ancestors(state, b)].filter((o) => ancA.has(o));
  const best = common.filter(
    (c) => !common.some((other) => other !== c && isAncestor(state, c, other)),
  );
  return best.sort((x, y) => (state.commits[y].time - state.commits[x].time) || (x < y ? -1 : 1));
}

/**
 * Commits reachable from the starting points, newest first. Like `git log --date-order`: a commit is
 * never shown before one of its children, and otherwise the newer commit comes first.
 */
export function walk(state: RepoState, starts: Oid[], exclude: Set<Oid> = new Set()): Commit[] {
  const members = new Set<Oid>();
  for (const s of starts) for (const o of ancestors(state, s)) if (!exclude.has(o)) members.add(o);
  const pendingChildren = new Map<Oid, number>();
  for (const oid of members) pendingChildren.set(oid, 0);
  for (const oid of members) {
    for (const p of new Set(state.commits[oid].parents)) {
      if (members.has(p)) pendingChildren.set(p, (pendingChildren.get(p) ?? 0) + 1);
    }
  }
  const order = new Map<Oid, number>();
  let counter = 0;
  const ready: Oid[] = [];
  const push = (oid: Oid) => {
    if (!order.has(oid)) order.set(oid, counter++);
    ready.push(oid);
  };
  for (const oid of members) if (pendingChildren.get(oid) === 0) push(oid);
  const out: Commit[] = [];
  while (ready.length) {
    ready.sort((x, y) => {
      const dt = state.commits[y].time - state.commits[x].time;
      return dt !== 0 ? dt : (order.get(x) as number) - (order.get(y) as number);
    });
    const oid = ready.shift() as Oid;
    const commit = state.commits[oid];
    out.push(commit);
    for (const p of new Set(commit.parents)) {
      if (!members.has(p)) continue;
      const left = (pendingChildren.get(p) as number) - 1;
      pendingChildren.set(p, left);
      if (left === 0) push(p);
    }
  }
  return out;
}

export function countBetween(state: RepoState, from: Oid, to: Oid): number {
  return walk(state, [to], ancestors(state, from)).length;
}

/**
 * Where a remote-tracking ref's reflog is kept. types.ts has no field for these, so they live in
 * branchReflogs under their full ref name, which no branch can have. pull --rebase reads them to find
 * the fork point, and `origin/main@{1}` resolves through them.
 */
export function trackingReflogKey(key: string): string {
  return `refs/remotes/${key}`;
}

/**
 * git's fork point (merge-base --fork-point): the newest value the remote-tracking ref has had that
 * the branch is built on, found through the ref's reflog. null when there is none.
 */
export function forkPoint(state: RepoState, key: string, head: Oid): Oid | null {
  const revs = (state.branchReflogs[trackingReflogKey(key)] ?? []).map((e) => e.oid);
  if (revs.length === 0) return null;
  const fromRevs = new Set<Oid>();
  for (const r of revs) for (const o of ancestors(state, r)) fromRevs.add(o);
  const common = [...ancestors(state, head)].filter((o) => fromRevs.has(o));
  const best = common.filter((c) => !common.some((other) => other !== c && isAncestor(state, c, other)));
  return best.length === 1 && revs.includes(best[0]) ? best[0] : null;
}
