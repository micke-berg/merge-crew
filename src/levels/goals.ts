// Small, reusable goal checks for level files.
// Built only on RepoState and the Queries interface. Commits are matched by message, never by oid,
// because oids depend on the order the player typed things in.

import type { ActorId, Commit, Goal, Oid, Path, Queries, RepoState } from "@/engine/types";

export type Check = Goal["check"];

/** Something that points at a commit. */
export type RefTarget =
  | { kind: "branch"; name: string }
  | { kind: "remote"; remote: string; branch: string }
  | { kind: "head"; actor: ActorId };

export const branch = (name: string): RefTarget => ({ kind: "branch", name });
export const remoteBranch = (remote: string, branchName: string): RefTarget => ({
  kind: "remote",
  remote,
  branch: branchName,
});
export const head = (actor: ActorId): RefTarget => ({ kind: "head", actor });

/** The commit a target points at, or null when it does not exist (unborn, deleted, never pushed). */
export function tipOf(state: RepoState, queries: Queries, target: RefTarget): Oid | null {
  switch (target.kind) {
    case "branch":
      return state.branches[target.name] ?? null;
    case "remote":
      return state.remotes[target.remote]?.branches[target.branch] ?? null;
    case "head":
      return queries.resolve(state, target.actor, "HEAD");
  }
}

/** Every commit with this exact message, in any state (reachable or lost). */
export function commitsWithMessage(state: RepoState, message: string): Commit[] {
  return Object.values(state.commits).filter((c) => c.message === message);
}

/** History reachable from a target, newest first. Empty when the target does not exist. */
export function historyOf(state: RepoState, queries: Queries, target: RefTarget): Commit[] {
  const tip = tipOf(state, queries, target);
  return tip ? queries.history(state, tip) : [];
}

// ---------------------------------------------------------------------------
// Checks. Each returns a Goal["check"].
// ---------------------------------------------------------------------------

export const allOf =
  (...checks: Check[]): Check =>
  (state, queries) =>
    checks.every((c) => c(state, queries));

/** A commit with this message is reachable from the target (any copy counts, e.g. a cherry-pick). */
export const commitWithMessageReachableFrom =
  (target: RefTarget, message: string): Check =>
  (state, queries) =>
    historyOf(state, queries, target).some((c) => c.message === message);

/** Shorthand for "this message is in <remote>/<branch> on the server". */
export const remoteBranchContains = (remote: string, branchName: string, message: string): Check =>
  commitWithMessageReachableFrom(remoteBranch(remote, branchName), message);

/**
 * The original commit with this message is reachable from the target, and no rewritten copy exists.
 * Use it to say "this work stayed as it was": a rebase, amend or cherry-pick would create a second
 * commit with the same message.
 */
export const originalCommitReachableFrom =
  (target: RefTarget, message: string): Check =>
  (state, queries) => {
    const copies = commitsWithMessage(state, message);
    if (copies.length !== 1) return false;
    const tip = tipOf(state, queries, target);
    if (!tip) return false;
    const oid = copies[0].oid;
    return oid === tip || queries.isAncestor(state, oid, tip);
  };

/** The commit the target points at has this message. */
export const pointsAtMessage =
  (target: RefTarget, message: string): Check =>
  (state, queries) => {
    const tip = tipOf(state, queries, target);
    return tip !== null && state.commits[tip]?.message === message;
  };

/** The local branch's tip commit has this message. */
export const branchPointsAt = (name: string, message: string): Check =>
  pointsAtMessage(branch(name), message);

/** The actor has this branch checked out. */
export const currentBranchIs =
  (actor: ActorId, name: string): Check =>
  (state, queries) =>
    queries.currentBranch(state, actor) === name;

/** Nothing staged, nothing modified, no untracked files, no conflicts, no operation in progress. */
export const workingTreeClean =
  (actor: ActorId): Check =>
  (state, queries) => {
    const s = queries.status(state, actor);
    return (
      s.staged.length === 0 &&
      s.unstaged.length === 0 &&
      s.untracked.length === 0 &&
      s.conflicted.length === 0 &&
      (state.worktrees[actor]?.inProgress ?? null) === null
    );
  };

/** Every commit the repository has ever made is reachable from some ref. */
export const noLostCommits = (): Check => (state, queries) => queries.lost(state).length === 0;

/** The file in the target's tip commit has exactly this content. */
export const fileInTipEquals =
  (target: RefTarget, path: Path, content: string): Check =>
  (state, queries) => {
    const tip = tipOf(state, queries, target);
    return tip !== null && state.commits[tip]?.tree[path] === content;
  };

/** The target's history contains at least this many commits. */
export const historyAtLeast =
  (target: RefTarget, count: number): Check =>
  (state, queries) =>
    historyOf(state, queries, target).length >= count;

/** The target's history contains a merge commit (two or more parents). */
export const hasMergeCommit =
  (target: RefTarget): Check =>
  (state, queries) =>
    historyOf(state, queries, target).some((c) => c.parents.length > 1);

/**
 * Some local branch other than `base` holds commits that `base` does not have.
 * `except` skips branches the level created itself (robot branches).
 */
export const someBranchAheadOf =
  (base: string, except: string[] = []): Check =>
  (state, queries) => {
    const baseTip = state.branches[base];
    if (!baseTip) return false;
    return Object.entries(state.branches).some(
      ([name, tip]) =>
        name !== base && !except.includes(name) && tip !== baseTip && !queries.isAncestor(state, tip, baseTip),
    );
  };

// ---------------------------------------------------------------------------
// Checks added for Act 2 (conflicts, stash, revert, cherry-pick).
// ---------------------------------------------------------------------------

const CONFLICT_MARKER = /^(<{7}|={7}|>{7})( |$)/m;

/**
 * The file in the target's tip commit contains every one of these lines, in any order, and no
 * conflict markers. Use it when a conflict may be resolved in more than one fair way.
 */
export const fileInTipHasLines =
  (target: RefTarget, path: Path, lines: string[]): Check =>
  (state, queries) => {
    const tip = tipOf(state, queries, target);
    const content = tip ? state.commits[tip]?.tree[path] : undefined;
    if (content === undefined || CONFLICT_MARKER.test(content)) return false;
    const have = new Set(content.split("\n"));
    return lines.every((line) => have.has(line));
  };

/** No commit with this message is reachable from the target. */
export const noCommitWithMessageReachableFrom =
  (target: RefTarget, message: string): Check =>
  (state, queries) =>
    !historyOf(state, queries, target).some((c) => c.message === message);

/** The tip of some local branch has every one of these files with exactly this content. */
export const someBranchTipHasFiles =
  (files: Readonly<Record<Path, string>>): Check =>
  (state) =>
    Object.values(state.branches).some((tip) => {
      const tree = state.commits[tip]?.tree;
      return tree !== undefined && Object.entries(files).every(([path, content]) => tree[path] === content);
    });

/** A stash entry whose message contains this text is still in the stash list. */
export const stashHasEntry =
  (text: string): Check =>
  (state) =>
    state.stash.some((entry) => entry.message.includes(text));

export const anyOf =
  (...checks: Check[]): Check =>
  (state, queries) =>
    checks.some((c) => c(state, queries));
