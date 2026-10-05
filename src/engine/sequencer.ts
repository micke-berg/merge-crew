// Shared pieces of the commands that replay commits one by one: rebase, cherry-pick and revert.
// Each replay is a three-way merge of one commit's change onto HEAD, like git's sequencer with the
// ort strategy.

import { fail, type Ctx } from "./context";
import { mergeTrees } from "./merge3";
import { changedPaths, createCommit, get, shortOid, sortedTree, subject, treesEqual } from "./objects";
import type { ActorId, FileTree, InProgress, Oid, Path, RefChangeReason } from "./types";
import { writeTreeMerge } from "./commands/merge";

/**
 * The in-progress record for cherry-pick and revert. types.ts names only the commit being applied;
 * the engine also keeps the commits still to apply and the HEAD to go back to on --abort. The extra
 * fields travel inside the same object (plain data, copied with the state).
 */
export type PickInProgress = {
  kind: "cherry-pick" | "revert";
  oid: Oid;
  /** Commits still to apply after `oid`, in order. */
  todo?: Oid[];
  /** HEAD before the command started, for --abort. null on an unborn branch. */
  head?: Oid | null;
};

export type RebaseInProgress = Extract<InProgress, { kind: "rebase" }>;

export function pickState(ctx: Ctx): PickInProgress | null {
  const ip = ctx.wt.inProgress;
  return ip && (ip.kind === "cherry-pick" || ip.kind === "revert") ? (ip as PickInProgress) : null;
}

export function rebaseState(ctx: Ctx): RebaseInProgress | null {
  const ip = ctx.wt.inProgress;
  return ip && ip.kind === "rebase" ? ip : null;
}

/** "1a2b3c4 (Add login)", the label git puts on the incoming side of a replayed commit. */
export function commitLabel(ctx: Ctx, oid: Oid): string {
  return `${shortOid(oid)} (${subject(ctx.state.commits[oid].message)})`;
}

/**
 * Apply the change from `base` to `theirs` on top of HEAD, writing index, files and conflicts.
 * Returns the conflicted paths (empty when the change applied cleanly).
 */
export function applyChange(ctx: Ctx, base: FileTree, theirs: FileTree, label: string): Path[] {
  const headTree = ctx.headTree();
  const result = mergeTrees(base, headTree, theirs, { ours: "HEAD", theirs: label });
  return writeTreeMerge(ctx, headTree, result);
}

/** Create a commit from the index on top of HEAD and move HEAD (or its branch) to it. */
export function commitOnHead(
  ctx: Ctx,
  opts: { message: string; author: ActorId; reason: RefChangeReason; reflog: string },
): Oid {
  const wt = ctx.wt;
  const head = ctx.headOid();
  const commit = createCommit(ctx.state, {
    parents: head ? [head] : [],
    message: opts.message,
    tree: wt.index,
    author: opts.author,
    time: ctx.time,
  });
  const branch = wt.head.kind === "branch" ? wt.head.name : null;
  ctx.emit({ type: "commit-created", actor: ctx.actor, oid: commit.oid, parents: commit.parents, branch });
  ctx.advanceHead(commit.oid, opts.reason, opts.reflog);
  ctx.out(`[${branch ?? "detached HEAD"}${head ? "" : " (root-commit)"} ${shortOid(commit.oid)}] ${subject(opts.message)}`);
  return commit.oid;
}

/** True when the index is the same as HEAD's tree, i.e. a commit now would be empty. */
export function indexMatchesHead(ctx: Ctx): boolean {
  return treesEqual(ctx.wt.index, ctx.headTree());
}

/** Tracked files whose working copy differs from the index (what git calls unstaged changes). */
export function unstagedPaths(ctx: Ctx): Path[] {
  const wt = ctx.wt;
  return Object.keys(wt.index).filter((p) => get(wt.workingTree, p) !== wt.index[p]);
}

/** Refuse when the worktree has uncommitted changes, with rebase's wording. */
export function requireCleanTree(ctx: Ctx, what: "rebase" | "pull with rebase"): void {
  const unstaged = unstagedPaths(ctx).length > 0 || Object.keys(ctx.wt.conflicts).length > 0;
  const staged = changedPaths(ctx.headTree(), ctx.wt.index).length > 0;
  if (!unstaged && !staged) return;
  const lines: string[] = [];
  if (unstaged) lines.push(`error: cannot ${what}: You have unstaged changes.`);
  if (staged) {
    lines.push(unstaged ? "error: additionally, your index contains uncommitted changes." : `error: cannot ${what}: Your index contains uncommitted changes.`);
  }
  fail(...lines, "error: Please commit or stash them.");
}

/**
 * Move the worktree to `target` like `git reset --merge`, which is what an --abort does: paths the
 * operation touched (staged changes and conflicts) and paths that differ between HEAD and the target
 * go to the target's version, other local edits stay.
 */
export function resetMerge(ctx: Ctx, target: Oid | null): void {
  const wt = ctx.wt;
  const headTree = ctx.headTree();
  const targetTree = ctx.tree(target);
  const index: Record<Path, string> = { ...wt.index };
  const working: Record<Path, string> = { ...wt.workingTree };
  const paths = new Set<Path>([
    ...changedPaths(headTree, wt.index),
    ...Object.keys(wt.conflicts),
    ...changedPaths(headTree, targetTree),
  ]);
  for (const path of paths) {
    const t = get(targetTree, path);
    if (t === undefined) {
      delete index[path];
      delete working[path];
    } else {
      index[path] = t;
      working[path] = t;
    }
  }
  wt.index = sortedTree(index);
  wt.workingTree = sortedTree(working);
  if (Object.keys(wt.conflicts).length) ctx.conflictsDiscarded = true;
  wt.conflicts = {};
}

/** Replace index and tracked files with HEAD's tree, like `git reset --hard` (used by --skip). */
export function resetHardToHead(ctx: Ctx): void {
  const wt = ctx.wt;
  const headTree = ctx.headTree();
  const tracked = new Set<Path>([...Object.keys(wt.index), ...Object.keys(wt.conflicts), ...Object.keys(headTree)]);
  const working: Record<Path, string> = { ...wt.workingTree };
  for (const path of tracked) if (get(headTree, path) === undefined) delete working[path];
  for (const [path, content] of Object.entries(headTree)) working[path] = content;
  wt.index = sortedTree({ ...headTree });
  wt.workingTree = sortedTree(working);
  if (Object.keys(wt.conflicts).length) ctx.conflictsDiscarded = true;
  wt.conflicts = {};
}

/** The message `git revert` writes, including git's "Reapply" for reverting a revert. */
export function revertMessage(ctx: Ctx, oid: Oid): string {
  const subj = subject(ctx.state.commits[oid].message);
  const rest = subj.startsWith('Revert "') ? subj.slice(8) : null;
  const title = rest !== null && !rest.startsWith('Revert "') ? `Reapply "${rest}` : `Revert "${subj}"`;
  return `${title}\n\nThis reverts commit ${oid}.`;
}
