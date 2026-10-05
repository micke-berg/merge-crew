// Commit objects, trees and small shared helpers.

import { sha1 } from "./hash";
import type { ActorId, Commit, FileTree, Oid, Path, RepoState } from "./types";

/** Git writes this where a reflog entry has no old or new value. */
export const ZERO_OID: Oid = "0".repeat(40);

export const EMPTY_TREE: FileTree = Object.freeze({});

export function shortOid(oid: Oid | null | undefined): string {
  return (oid ?? ZERO_OID).slice(0, 7);
}

/** First line of a commit message, as git shows it in reflogs and one-line logs. */
export function subject(message: string): string {
  const line = message.split("\n")[0];
  return line;
}

/**
 * Git's default "whitespace" cleanup for messages given with -m: trailing whitespace is removed from
 * every line, leading and trailing blank lines are dropped, and runs of blank lines collapse to one.
 */
export function cleanupMessage(message: string): string {
  const lines = message.split("\n").map((l) => l.replace(/\s+$/, ""));
  const out: string[] = [];
  for (const line of lines) {
    if (line === "") {
      if (out.length === 0 || out[out.length - 1] === "") continue;
    }
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

export function sortedTree(tree: Record<Path, string>): FileTree {
  const out: Record<Path, string> = {};
  for (const key of Object.keys(tree).sort()) out[key] = tree[key];
  return out;
}

export function treesEqual(a: FileTree, b: FileTree): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || a[k] !== b[k]) return false;
  return true;
}

export function has(tree: FileTree, path: Path): boolean {
  return Object.prototype.hasOwnProperty.call(tree, path);
}

export function get(tree: FileTree, path: Path): string | undefined {
  return has(tree, path) ? tree[path] : undefined;
}

/** Paths whose content differs between two trees, sorted. */
export function changedPaths(a: FileTree, b: FileTree): Path[] {
  const out: Path[] = [];
  for (const k of Object.keys(a)) if (get(b, k) !== a[k]) out.push(k);
  for (const k of Object.keys(b)) if (!has(a, k)) out.push(k);
  return out.sort();
}

function serialize(parts: { parents: Oid[]; message: string; tree: FileTree; author: ActorId; time: number }): string {
  const files = Object.keys(parts.tree)
    .sort()
    .map((p) => `${p.length}:${p}${parts.tree[p].length}:${parts.tree[p]}`)
    .join("");
  return `tree ${files}\nparents ${parts.parents.join(" ")}\nauthor ${parts.author}\ntime ${parts.time}\n\n${parts.message}`;
}

/** Create a commit in the shared store. Same inputs give the same oid. */
export function createCommit(
  state: RepoState,
  parts: { parents: Oid[]; message: string; tree: FileTree; author: ActorId; time: number },
): Commit {
  const oid = sha1(serialize(parts));
  const existing = state.commits[oid];
  if (existing) return existing;
  const commit: Commit = {
    oid,
    parents: [...parts.parents],
    message: parts.message,
    tree: sortedTree({ ...parts.tree }),
    author: parts.author,
    time: parts.time,
  };
  state.commits[oid] = commit;
  return commit;
}

export function treeOf(state: RepoState, oid: Oid | null): FileTree {
  if (!oid) return EMPTY_TREE;
  return state.commits[oid]?.tree ?? EMPTY_TREE;
}

/** Deep copy of every mutable container. Commits are immutable and shared. */
export function cloneState(s: RepoState): RepoState {
  const worktrees: RepoState["worktrees"] = {};
  for (const [actor, wt] of Object.entries(s.worktrees)) {
    worktrees[actor] = {
      ...wt,
      head: { ...wt.head },
      index: { ...wt.index },
      conflicts: { ...wt.conflicts },
      workingTree: { ...wt.workingTree },
      headReflog: [...wt.headReflog],
      inProgress: wt.inProgress ? structuredCopy(wt.inProgress) : null,
    };
  }
  const branchReflogs: RepoState["branchReflogs"] = {};
  for (const [k, v] of Object.entries(s.branchReflogs)) branchReflogs[k] = [...v];
  const remotes: RepoState["remotes"] = {};
  for (const [k, v] of Object.entries(s.remotes)) remotes[k] = { name: v.name, branches: { ...v.branches } };
  const upstreams: RepoState["upstreams"] = {};
  for (const [k, v] of Object.entries(s.upstreams)) upstreams[k] = { ...v };
  return {
    commits: { ...s.commits },
    branches: { ...s.branches },
    branchReflogs,
    upstreams,
    remoteTracking: { ...s.remoteTracking },
    remotes,
    worktrees,
    stash: s.stash.map((e) => ({ ...e })),
    clock: s.clock,
  };
}

function structuredCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Order-insensitive structural equality for plain data. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  if (ka.length !== Object.keys(rb).length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(rb, k)) return false;
    if (!deepEqual(ra[k], rb[k])) return false;
  }
  return true;
}
