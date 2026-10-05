// git merge, plus the merge step that git pull reuses.

import { flag, parseArgs, value } from "../args";
import { fail, twoWayCheckout, type Ctx } from "../context";
import { mergeTrees } from "../merge3";
import { changedPaths, createCommit, get, has, shortOid, sortedTree } from "../objects";
import { isAncestor, mergeBases, remoteTrackingKey, resolveRev, splitRev } from "../revisions";
import type { FileTree, Oid, Path } from "../types";
import { commitIndex, unmergedFailure } from "./commit";

export type MergeOptions = {
  theirs: Oid;
  /** The name for "theirs" in conflict markers. */
  label: string;
  message: string;
  /** Reflog prefix, e.g. "merge feature" or "pull". */
  reflogPrefix: string;
  ff: "allow" | "never" | "only";
};

/** " into <branch>" unless the branch is main or master (git's merge.suppressDest default). */
export function intoSuffix(ctx: Ctx): string {
  const wt = ctx.wt;
  if (wt.head.kind !== "branch") return "";
  return wt.head.name === "main" || wt.head.name === "master" ? "" : ` into ${wt.head.name}`;
}

/** The message git's fmt-merge-msg writes for `git merge <name>`. */
export function defaultMergeMessage(ctx: Ctx, name: string, theirs: Oid): string {
  const { base, suffix } = splitRev(name);
  const branchOid = ctx.state.branches[base];
  let msg: string;
  if (branchOid !== undefined && !base.includes("@{")) {
    msg = `Merge branch '${base}'${suffix && branchOid !== theirs ? " (early part)" : ""}`;
  } else if (!suffix && remoteTrackingKey(ctx.state, name)) {
    msg = `Merge remote-tracking branch '${name}'`;
  } else {
    msg = `Merge commit '${name}'`;
  }
  return msg + intoSuffix(ctx);
}

/** A tree for the merge base. With several best bases, merge them first (ort's recursive base). */
function baseTree(ctx: Ctx, bases: Oid[]): FileTree {
  if (bases.length === 0) return {};
  let tree = ctx.tree(bases[0]);
  for (let i = 1; i < bases.length; i++) {
    const inner = mergeBases(ctx.state, bases[0], bases[i]);
    const r = mergeTrees(baseTree(ctx, inner), tree, ctx.tree(bases[i]), {
      ours: "Temporary merge branch 1",
      theirs: "Temporary merge branch 2",
    });
    const next: Record<Path, string> = { ...r.merged };
    for (const [path, content] of Object.entries(r.conflictFiles)) if (content !== null) next[path] = content;
    tree = next;
  }
  return tree;
}

export function runMerge(ctx: Ctx, opts: MergeOptions): void {
  const wt = ctx.wt;
  const head = ctx.headOid();
  const theirTree = ctx.tree(opts.theirs);

  if (!head) {
    // Merging into an unborn branch just checks the other side out.
    const next = twoWayCheckout({}, theirTree, wt.index, wt.workingTree, "merge");
    wt.index = sortedTree(next.index);
    wt.workingTree = sortedTree(next.working);
    ctx.advanceHead(opts.theirs, "fast-forward", `${opts.reflogPrefix}: Fast-forward`);
    return;
  }
  if (isAncestor(ctx.state, opts.theirs, head)) {
    ctx.out("Already up to date.");
    return;
  }
  const canFastForward = isAncestor(ctx.state, head, opts.theirs);
  if (canFastForward && opts.ff !== "never") {
    const next = twoWayCheckout(ctx.tree(head), theirTree, wt.index, wt.workingTree, "merge");
    ctx.out(`Updating ${shortOid(head)}..${shortOid(opts.theirs)}`, "Fast-forward");
    wt.index = sortedTree(next.index);
    wt.workingTree = sortedTree(next.working);
    ctx.advanceHead(opts.theirs, "fast-forward", `${opts.reflogPrefix}: Fast-forward`);
    return;
  }
  if (opts.ff === "only") {
    ctx.hint(
      "hint: Diverging branches can't be fast-forwarded, you need to either:",
      "hint:",
      "hint: \tgit merge --no-ff",
      "hint:",
      "hint: or:",
      "hint:",
      "hint: \tgit rebase",
    );
    fail("fatal: Not possible to fast-forward, aborting.");
  }

  const headTree = ctx.tree(head);
  // ort refuses to start with anything staged, even in files the merge does not touch.
  const staged = changedPaths(headTree, wt.index);
  if (staged.length) {
    fail(
      "error: Your local changes to the following files would be overwritten by merge:",
      ...staged.map((p) => `  ${p}`),
      "Merge with strategy ort failed.",
    );
  }

  const result = mergeTrees(baseTree(ctx, mergeBases(ctx.state, head, opts.theirs)), headTree, theirTree, {
    ours: "HEAD",
    theirs: opts.label,
  });
  const conflicted = Object.keys(result.conflicts);
  const touched = new Set<Path>([...changedPaths(headTree, result.merged), ...conflicted]);

  const dirty: Path[] = [];
  const untracked: Path[] = [];
  for (const path of touched) {
    const w = get(wt.workingTree, path);
    if (has(headTree, path)) {
      if (w !== undefined && w !== headTree[path]) dirty.push(path);
    } else if (w !== undefined) {
      untracked.push(path);
    }
  }
  if (dirty.length) {
    fail(
      "error: Your local changes to the following files would be overwritten by merge:",
      ...dirty.sort().map((p) => `\t${p}`),
      "Please commit your changes or stash them before you merge.",
      "Aborting",
    );
  }
  if (untracked.length) {
    fail(
      "error: The following untracked working tree files would be overwritten by merge:",
      ...untracked.sort().map((p) => `\t${p}`),
      "Please move or remove them before you merge.",
      "Aborting",
    );
  }

  const working: Record<Path, string> = { ...wt.workingTree };
  for (const path of touched) {
    const content = path in result.conflictFiles ? result.conflictFiles[path] : get(result.merged, path) ?? null;
    if (content === null) delete working[path];
    else working[path] = content;
  }
  wt.index = sortedTree(result.merged);
  wt.workingTree = sortedTree(working);
  ctx.out(...result.messages);

  if (conflicted.length === 0) {
    const commit = createCommit(ctx.state, {
      parents: [head, opts.theirs],
      message: opts.message,
      tree: wt.index,
      author: ctx.actor,
      time: ctx.time,
    });
    const branch = wt.head.kind === "branch" ? wt.head.name : null;
    ctx.emit({ type: "commit-created", actor: ctx.actor, oid: commit.oid, parents: commit.parents, branch });
    ctx.advanceHead(commit.oid, "merge", `${opts.reflogPrefix}: Merge made by the 'ort' strategy.`);
    ctx.out("Merge made by the 'ort' strategy.");
    return;
  }

  wt.conflicts = { ...result.conflicts };
  wt.inProgress = { kind: "merge", theirs: opts.theirs, message: opts.message };
  ctx.emit({ type: "operation", actor: ctx.actor, kind: "merge", phase: "started" });
  ctx.emit({ type: "conflict", actor: ctx.actor, paths: conflicted.sort() });
  ctx.emit({ type: "operation", actor: ctx.actor, kind: "merge", phase: "stopped" });
  ctx.err("Automatic merge failed; fix conflicts and then commit the result.");
}

/** Refuse to start a merge or pull while one is unfinished. */
export function checkNoMergeInProgress(ctx: Ctx, what: "Merging" | "Pulling"): void {
  const wt = ctx.wt;
  if (Object.keys(wt.conflicts).length) unmergedFailure(ctx, what);
  if (wt.inProgress?.kind === "merge") {
    fail("fatal: You have not concluded your merge (MERGE_HEAD exists).", "Please, commit your changes before you merge.");
  }
  if (wt.inProgress) fail(`fatal: a ${wt.inProgress.kind} is in progress`);
}

function abortMerge(ctx: Ctx): void {
  const wt = ctx.wt;
  if (wt.inProgress?.kind !== "merge") fail("fatal: There is no merge to abort (MERGE_HEAD missing).");
  // Like `git reset --merge`: paths the merge touched go back to HEAD, other local edits stay.
  const head = ctx.headOid() as Oid;
  const headTree = ctx.tree(head);
  const index: Record<Path, string> = { ...wt.index };
  const working: Record<Path, string> = { ...wt.workingTree };
  const paths = new Set<Path>([...changedPaths(headTree, wt.index), ...Object.keys(wt.conflicts)]);
  for (const path of paths) {
    const h = get(headTree, path);
    if (h === undefined) {
      delete index[path];
      delete working[path];
    } else {
      index[path] = h;
      working[path] = h;
    }
  }
  wt.index = sortedTree(index);
  wt.workingTree = sortedTree(working);
  if (Object.keys(wt.conflicts).length) ctx.conflictsDiscarded = true;
  wt.conflicts = {};
  wt.inProgress = null;
  ctx.emit({ type: "operation", actor: ctx.actor, kind: "merge", phase: "aborted" });
  ctx.advanceHead(head, "reset", "reset: moving to HEAD");
}

export function merge(ctx: Ctx, args: string[]): void {
  const p = parseArgs("merge", args, {
    "--abort": {},
    "--continue": {},
    "--no-ff": {},
    "--ff": {},
    "--ff-only": {},
    "-m": { value: true },
    "--message": { value: true, alias: "-m" },
    "--no-edit": {},
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  const wt = ctx.wt;
  if (flag(p, "--abort")) {
    abortMerge(ctx);
    return;
  }
  if (flag(p, "--continue")) {
    if (wt.inProgress?.kind !== "merge") fail("fatal: There is no merge in progress (MERGE_HEAD missing).");
    commitIndex(ctx, {});
    return;
  }
  checkNoMergeInProgress(ctx, "Merging");
  if (p.positional.length === 0) fail("fatal: No remote for the current branch.");
  if (p.positional.length > 1) fail("Merging several branches at once (octopus merge) is not supported in Merge Crew yet");
  const name = p.positional[0];
  const theirs = resolveRev(ctx.state, ctx.actor, name);
  if (!theirs) fail(`merge: ${name} - not something we can merge`);
  const message = value(p, "-m") ?? defaultMergeMessage(ctx, name, theirs);
  runMerge(ctx, {
    theirs,
    label: name,
    message,
    reflogPrefix: `merge ${name}`,
    ff: flag(p, "--ff-only") ? "only" : flag(p, "--no-ff") ? "never" : "allow",
  });
}

