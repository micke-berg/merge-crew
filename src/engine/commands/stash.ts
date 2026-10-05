// git stash: push, list, show, apply, pop, drop, clear, branch
//
// How a StashEntry maps to git's structure. Like git, a stash is a commit in `commits`:
//   - the index commit "index on <branch>: <short> <subject>": tree = the index, parent = HEAD
//   - with -u, the untracked commit "untracked files on <branch>: ...": tree = the untracked files only,
//     no parents
//   - the stash commit itself (StashEntry.oid) "WIP on <branch>: ..." or "On <branch>: <message>":
//     tree = the index with the working-file version of every tracked path, parents =
//     [HEAD, index commit] plus the untracked commit when there is one
// StashEntry.base is that HEAD, StashEntry.index the index commit's tree and StashEntry.workingTree
// the stash commit's tree. The untracked files are found through the stash commit's third parent.
// `state.stash` plays the role of the refs/stash reflog, newest first.

import { flag, parseArgs, value } from "../args";
import { fail, notSupported, twoWayCheckout, type Ctx } from "../context";
import { mergeTrees } from "../merge3";
import { createCommit, get, shortOid, sortedTree, subject, treesEqual } from "../objects";
import { resolveRev } from "../revisions";
import { unstagedPaths } from "../sequencer";
import type { FileTree, Path, StashEntry } from "../types";
import { diffStat, patchLines, treeChanges } from "../unified";
import { checkNewBranchName, createBranch } from "./branch";
import { writeTreeMerge } from "./merge";
import { statusLines } from "./status";

function needsMerge(ctx: Ctx): void {
  const conflicted = Object.keys(ctx.wt.conflicts).sort();
  if (conflicted.length) fail(...conflicted.map((p) => `${p}: needs merge`), "error: could not write index");
}

function branchLabel(ctx: Ctx): string {
  const wt = ctx.wt;
  return wt.head.kind === "branch" ? wt.head.name : "(no branch)";
}

function push(ctx: Ctx, args: string[]): void {
  const p = parseArgs("stash push", args, {
    "-m": { value: true },
    "--message": { value: true, alias: "-m" },
    "-u": {},
    "--include-untracked": { alias: "-u" },
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  if (p.positional.length || p.afterDashes) notSupported("git stash push with paths");
  const wt = ctx.wt;
  const head = ctx.headOid();
  if (!head) fail("You do not have the initial commit yet");
  needsMerge(ctx);
  const headTree = ctx.tree(head);
  const withUntracked = flag(p, "-u");
  const untracked = Object.keys(wt.workingTree)
    .filter((path) => get(wt.index, path) === undefined)
    .sort();
  const trackedChanges = !treesEqual(headTree, wt.index) || unstagedPaths(ctx).length > 0;
  if (!trackedChanges && !(withUntracked && untracked.length)) {
    ctx.out("No local changes to save");
    return;
  }

  const where = branchLabel(ctx);
  const headLine = `${shortOid(head)} ${subject(ctx.state.commits[head].message)}`;
  const indexCommit = createCommit(ctx.state, {
    parents: [head],
    message: `index on ${where}: ${headLine}`,
    tree: wt.index,
    author: ctx.actor,
    time: ctx.time,
  });
  const parents = [head, indexCommit.oid];
  if (withUntracked && untracked.length) {
    const files: Record<Path, string> = {};
    for (const path of untracked) files[path] = wt.workingTree[path];
    parents.push(
      createCommit(ctx.state, {
        parents: [],
        message: `untracked files on ${where}: ${headLine}`,
        tree: files,
        author: ctx.actor,
        time: ctx.time,
      }).oid,
    );
  }
  const workTree: Record<Path, string> = {};
  for (const path of Object.keys(wt.index)) {
    const w = get(wt.workingTree, path);
    if (w !== undefined) workTree[path] = w;
  }
  const msg = value(p, "-m");
  const message = msg !== undefined ? `On ${where}: ${msg}` : `WIP on ${where}: ${headLine}`;
  const stashCommit = createCommit(ctx.state, { parents, message, tree: workTree, author: ctx.actor, time: ctx.time });
  const entry: StashEntry = {
    oid: stashCommit.oid,
    message,
    base: head,
    index: indexCommit.tree,
    workingTree: stashCommit.tree,
  };
  ctx.state.stash.unshift(entry);
  ctx.emit({ type: "stash-pushed", actor: ctx.actor, oid: stashCommit.oid });
  ctx.out(`Saved working directory and index state ${message}`);

  // Then `git reset --hard`, plus removing the untracked files that were saved.
  const working: Record<Path, string> = { ...wt.workingTree };
  for (const path of Object.keys(wt.index)) if (get(headTree, path) === undefined) delete working[path];
  for (const [path, content] of Object.entries(headTree)) working[path] = content;
  if (withUntracked) for (const path of untracked) delete working[path];
  wt.index = sortedTree({ ...headTree });
  wt.workingTree = sortedTree(working);
  ctx.advanceHead(head, "reset", "reset: moving to HEAD");
}

/** Which entry a stash argument names. */
function pickEntry(ctx: Ctx, ref: string | undefined): { n: number; entry: StashEntry } {
  const stash = ctx.state.stash;
  if (stash.length === 0) fail("No stash entries found.");
  let n: number;
  if (ref === undefined) n = 0;
  else if (/^\d+$/.test(ref)) n = Number(ref);
  else {
    const m = /^(?:refs\/)?stash@\{(\d+)\}$/.exec(ref);
    if (m) n = Number(m[1]);
    else {
      const oid = resolveRev(ctx.state, ctx.actor, ref);
      n = oid ? stash.findIndex((e) => e.oid === oid) : -1;
      if (n === -1) fail(`error: ${ref} is not a valid reference`);
    }
  }
  if (n >= stash.length) fail(`fatal: log for 'stash' only has ${stash.length} entries`);
  return { n, entry: stash[n] };
}

function untrackedTree(ctx: Ctx, entry: StashEntry): FileTree {
  const third = ctx.state.commits[entry.oid]?.parents[2];
  return third ? ctx.tree(third) : {};
}

/** Apply a stash entry to the worktree. Returns false when it stopped with conflicts. */
function applyEntry(ctx: Ctx, entry: StashEntry, restoreIndex: boolean): boolean {
  const wt = ctx.wt;
  needsMerge(ctx);
  const baseTree = ctx.tree(entry.base);
  const current = wt.index;

  const untracked = untrackedTree(ctx, entry);
  const existing = Object.keys(untracked).filter((path) => get(wt.workingTree, path) !== undefined);
  if (existing.length) {
    fail(...existing.map((path) => `${path} already exists, no checkout`), "error: could not restore untracked files from stash");
  }

  const indexChanged = !treesEqual(entry.index, baseTree);
  let restoredIndex: FileTree | null = null;
  if (restoreIndex && indexChanged) {
    const r = mergeTrees(baseTree, current, entry.index, { ours: "Updated upstream", theirs: "Stashed changes" });
    if (Object.keys(r.conflicts).length) fail("error: Conflicts in index. Try without --index.");
    restoredIndex = r.merged;
  }

  const result = mergeTrees(baseTree, current, entry.workingTree, { ours: "Updated upstream", theirs: "Stashed changes" });
  const conflicted = writeTreeMerge(ctx, current, result);
  const working: Record<Path, string> = { ...wt.workingTree, ...untracked };
  wt.workingTree = sortedTree(working);

  if (conflicted.length) {
    ctx.emit({ type: "conflict", actor: ctx.actor, paths: conflicted });
    ctx.out(...statusLines(ctx, false));
    return false;
  }
  if (restoredIndex) {
    wt.index = sortedTree({ ...restoredIndex });
    const head = ctx.headOid();
    if (head) ctx.advanceHead(head, "reset", "reset: moving to HEAD");
  } else {
    // Without --index, changes come back unstaged, except files the stash added.
    const index: Record<Path, string> = { ...current };
    for (const [path, content] of Object.entries(wt.index)) if (get(current, path) === undefined) index[path] = content;
    wt.index = sortedTree(index);
  }
  ctx.out(...statusLines(ctx, false));
  return true;
}

function drop(ctx: Ctx, n: number, label: string): void {
  const [entry] = ctx.state.stash.splice(n, 1);
  ctx.emit({ type: "stash-removed", actor: ctx.actor, oid: entry.oid, applied: false });
  ctx.out(`Dropped ${label} (${entry.oid})`);
}

function dropLabel(ref: string | undefined, n: number): string {
  return ref === undefined ? "refs/stash@{0}" : `stash@{${n}}`;
}

function apply(ctx: Ctx, args: string[], pop: boolean): void {
  const p = parseArgs(pop ? "stash pop" : "stash apply", args, { "--index": {}, "-q": {}, "--quiet": { alias: "-q" } });
  const ref = p.positional[0];
  const { n, entry } = pickEntry(ctx, ref);
  const clean = applyEntry(ctx, entry, flag(p, "--index"));
  if (!clean) {
    if (pop) ctx.out("The stash entry is kept in case you need it again.");
    return;
  }
  if (pop) {
    ctx.state.stash.splice(n, 1);
    ctx.emit({ type: "stash-removed", actor: ctx.actor, oid: entry.oid, applied: true });
    ctx.out(`Dropped ${dropLabel(ref, n)} (${entry.oid})`);
  }
}

function show(ctx: Ctx, args: string[]): void {
  const p = parseArgs("stash show", args, {
    "-p": {},
    "--patch": { alias: "-p" },
    "--stat": {},
    "--name-only": {},
  });
  const { entry } = pickEntry(ctx, p.positional[0]);
  const changes = treeChanges(ctx.tree(entry.base), entry.workingTree);
  if (flag(p, "--name-only")) ctx.out(...changes.map((c) => c.path));
  else if (flag(p, "-p")) ctx.out(...patchLines(changes));
  else ctx.out(...diffStat(changes));
}

function branchFromStash(ctx: Ctx, args: string[]): void {
  const [name, ref, ...extra] = args;
  if (!name || extra.length) fail("usage: git stash branch <branchname> [<stash>]");
  const { n, entry } = pickEntry(ctx, ref);
  checkNewBranchName(ctx, name, false);
  needsMerge(ctx);
  const wt = ctx.wt;
  const from = ctx.headOid();
  const fromLabel = wt.head.kind === "branch" ? wt.head.name : (from ?? "HEAD");
  const next = twoWayCheckout(ctx.tree(from), ctx.tree(entry.base), wt.index, wt.workingTree, "checkout");
  createBranch(ctx, name, entry.base, entry.base);
  wt.index = sortedTree(next.index);
  wt.workingTree = sortedTree(next.working);
  ctx.setHead(wt, { kind: "branch", name });
  ctx.logHead(wt, from, entry.base, `checkout: moving from ${fromLabel} to ${name}`);
  ctx.out(`Switched to a new branch '${name}'`);
  if (applyEntry(ctx, entry, true)) {
    ctx.state.stash.splice(n, 1);
    ctx.emit({ type: "stash-removed", actor: ctx.actor, oid: entry.oid, applied: true });
    ctx.out(`Dropped ${dropLabel(ref, n)} (${entry.oid})`);
  }
}

export function stash(ctx: Ctx, args: string[]): void {
  const [sub, ...rest] = args;
  if (sub === undefined || sub.startsWith("-")) return push(ctx, args);
  switch (sub) {
    case "push":
      return push(ctx, rest);
    case "list":
      ctx.state.stash.forEach((e, i) => ctx.out(`stash@{${i}}: ${e.message}`));
      return;
    case "show":
      return show(ctx, rest);
    case "apply":
      return apply(ctx, rest, false);
    case "pop":
      return apply(ctx, rest, true);
    case "drop": {
      const p = parseArgs("stash drop", rest, { "-q": {}, "--quiet": { alias: "-q" } });
      const { n } = pickEntry(ctx, p.positional[0]);
      drop(ctx, n, dropLabel(p.positional[0], n));
      return;
    }
    case "clear":
      for (const e of ctx.state.stash) ctx.emit({ type: "stash-removed", actor: ctx.actor, oid: e.oid, applied: false });
      ctx.state.stash.length = 0;
      return;
    case "branch":
      return branchFromStash(ctx, rest);
    case "save":
    case "create":
    case "store":
      notSupported(`git stash ${sub}`);
      break;
    default:
      fail(`error: unknown subcommand: \`${sub}'`, "usage: git stash list [<log-options>]");
  }
}

