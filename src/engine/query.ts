// Read-only questions about a repository state.

import { get, has, treeOf } from "./objects";
import { headOid, isAncestor, resolveRev, walk } from "./revisions";
import type { ActorId, Oid, Path, Queries, RepoState } from "./types";

function reachable(state: RepoState): Set<Oid> {
  const starts: Oid[] = [
    ...Object.values(state.branches),
    ...Object.values(state.remoteTracking),
    ...Object.values(state.remotes).flatMap((r) => Object.values(r.branches)),
    ...state.stash.map((s) => s.oid),
  ];
  for (const wt of Object.values(state.worktrees)) {
    const oid = headOid(state, wt);
    if (oid) starts.push(oid);
  }
  const seen = new Set<Oid>();
  const stack = starts.filter((o) => state.commits[o]);
  while (stack.length) {
    const oid = stack.pop() as Oid;
    if (seen.has(oid)) continue;
    seen.add(oid);
    for (const p of state.commits[oid]?.parents ?? []) if (!seen.has(p)) stack.push(p);
  }
  return seen;
}

function lost(state: RepoState): Oid[] {
  const live = reachable(state);
  return Object.values(state.commits)
    .filter((c) => !live.has(c.oid))
    .sort((a, b) => a.time - b.time || (a.oid < b.oid ? -1 : 1))
    .map((c) => c.oid);
}

function currentBranch(state: RepoState, actor: ActorId): string | null {
  const wt = state.worktrees[actor];
  if (!wt || wt.head.kind !== "branch") return null;
  return state.branches[wt.head.name] ? wt.head.name : null;
}

function status(state: RepoState, actor: ActorId): ReturnType<Queries["status"]> {
  const result: ReturnType<Queries["status"]> = { staged: [], unstaged: [], untracked: [], conflicted: [] };
  const wt = state.worktrees[actor];
  if (!wt) return result;
  const head = treeOf(state, headOid(state, wt));
  const conflicted = new Set(Object.keys(wt.conflicts));
  const paths = new Set<Path>([...Object.keys(head), ...Object.keys(wt.index), ...Object.keys(wt.workingTree)]);
  for (const path of [...paths].sort()) {
    if (conflicted.has(path)) continue;
    const h = get(head, path);
    const i = get(wt.index, path);
    const w = get(wt.workingTree, path);
    if (h !== i) {
      result.staged.push({ path, change: h === undefined ? "added" : i === undefined ? "deleted" : "modified" });
    }
    if (i !== undefined) {
      if (w === undefined) result.unstaged.push({ path, change: "deleted" });
      else if (w !== i) result.unstaged.push({ path, change: "modified" });
    } else if (w !== undefined && !has(wt.index, path)) {
      result.untracked.push(path);
    }
  }
  result.conflicted = [...conflicted].sort();
  return result;
}

export const queries: Queries = {
  resolve: resolveRev,
  isAncestor,
  reachable,
  lost,
  history: (state, from) => (state.commits[from] ? walk(state, [from]) : []),
  currentBranch,
  status,
};
