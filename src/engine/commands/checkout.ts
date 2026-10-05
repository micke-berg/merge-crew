// git switch, git checkout, git restore

import { flag, parseArgs, value } from "../args";
import { fail, twoWayCheckout, type Ctx } from "../context";
import { get, shortOid, sortedTree } from "../objects";
import { select } from "../pathspec";
import { previousCheckout, resolveRev } from "../revisions";
import type { FileTree, Oid } from "../types";
import { checkNewBranchName, createBranch, resolveOrFail, trackIfRemote } from "./branch";

type Target = { kind: "branch"; name: string } | { kind: "detached"; oid: Oid; label: string };

function requireCleanIndex(ctx: Ctx): void {
  const paths = Object.keys(ctx.wt.conflicts).sort();
  if (paths.length) fail(...paths.map((p) => `${p}: needs merge`), "error: you need to resolve your current index first");
}

/** Move this worktree's HEAD to a branch or commit, updating index and files like git checkout. */
export function switchTo(ctx: Ctx, target: Target): void {
  const wt = ctx.wt;
  requireCleanIndex(ctx);
  if (target.kind === "branch") {
    const user = ctx.worktreeUsing(target.name, ctx.actor);
    if (user) fail(`fatal: '${target.name}' is already used by worktree at '${user.path}'`);
  }
  const oldOid = ctx.headOid();
  const oldLabel = wt.head.kind === "branch" ? wt.head.name : wt.head.oid;
  const newOid = target.kind === "branch" ? (ctx.state.branches[target.name] ?? null) : target.oid;

  if (target.kind === "branch" && wt.head.kind === "branch" && wt.head.name === target.name) {
    if (newOid) ctx.logHead(wt, oldOid, newOid, `checkout: moving from ${oldLabel} to ${target.name}`);
    ctx.out(`Already on '${target.name}'`);
    return;
  }

  const next = twoWayCheckout(ctx.tree(oldOid), ctx.tree(newOid), wt.index, wt.workingTree, "checkout");
  wt.index = sortedTree(next.index);
  wt.workingTree = sortedTree(next.working);

  // Leaving a detached HEAD: warn about commits no branch will reach any more.
  if (wt.head.kind === "detached" && oldOid && oldOid !== newOid) {
    const left = countLeftBehind(ctx, oldOid, Object.values(ctx.state.branches));
    if (left > 0) {
      ctx.out(`Warning: you are leaving ${left} commit${left > 1 ? "s" : ""} behind, not connected to`, "any of your branches.");
    }
  }

  const head = target.kind === "branch" ? { kind: "branch" as const, name: target.name } : { kind: "detached" as const, oid: target.oid };
  ctx.setHead(wt, head);
  if (newOid) {
    const toLabel = target.kind === "branch" ? target.name : target.label;
    ctx.logHead(wt, oldOid, newOid, `checkout: moving from ${oldLabel} to ${toLabel}`);
  }
  if (target.kind === "branch") ctx.out(`Switched to branch '${target.name}'`);
  else ctx.out(`HEAD is now at ${ctx.oneline(target.oid)}`);
}

function countLeftBehind(ctx: Ctx, from: Oid, tips: Oid[]): number {
  const reachable = new Set<Oid>();
  for (const tip of tips) for (const c of walkAncestors(ctx, tip)) reachable.add(c);
  let n = 0;
  for (const c of walkAncestors(ctx, from)) if (!reachable.has(c)) n++;
  return n;
}

function walkAncestors(ctx: Ctx, from: Oid): Set<Oid> {
  const seen = new Set<Oid>();
  const stack = [from];
  while (stack.length) {
    const o = stack.pop() as Oid;
    if (seen.has(o) || !ctx.state.commits[o]) continue;
    seen.add(o);
    stack.push(...ctx.state.commits[o].parents);
  }
  return seen;
}

/** Create a branch and switch to it: switch -c / checkout -b. */
function createAndSwitch(ctx: Ctx, name: string, start: string | undefined, force: boolean): void {
  const wt = ctx.wt;
  checkNewBranchName(ctx, name, force);
  if (force && ctx.state.branches[name] !== undefined) {
    const user = ctx.worktreeUsing(name, ctx.actor);
    if (user) fail(`fatal: '${name}' is already used by worktree at '${user.path}'`);
  }
  const startOid = start === undefined ? ctx.headOid() : resolveRev(ctx.state, ctx.actor, start);
  if (start !== undefined && !startOid) fail(`fatal: invalid reference: ${start}`);
  if (!startOid) {
    // Unborn HEAD: only the name HEAD points at changes.
    ctx.setHead(wt, { kind: "branch", name });
    ctx.out(`Switched to a new branch '${name}'`);
    return;
  }
  const oldOid = ctx.headOid();
  const oldLabel = wt.head.kind === "branch" ? wt.head.name : wt.head.oid;
  requireCleanIndex(ctx);
  const next = twoWayCheckout(ctx.tree(oldOid), ctx.tree(startOid), wt.index, wt.workingTree, "checkout");
  createBranch(ctx, name, startOid, start ?? "HEAD");
  trackIfRemote(ctx, name, start);
  wt.index = sortedTree(next.index);
  wt.workingTree = sortedTree(next.working);
  ctx.setHead(wt, { kind: "branch", name });
  ctx.logHead(wt, oldOid, startOid, `checkout: moving from ${oldLabel} to ${name}`);
  ctx.out(`Switched to a new branch '${name}'`);
}

/** `git switch foo` with no local foo but exactly one origin/foo creates a tracking branch. */
function guessRemoteBranch(ctx: Ctx, name: string): string | null {
  const hits = Object.keys(ctx.state.remoteTracking).filter((k) => k.slice(k.indexOf("/") + 1) === name);
  return hits.length === 1 ? hits[0] : null;
}

function switchToName(ctx: Ctx, name: string, allowDetach: boolean): void {
  let ref = name;
  if (name === "-") {
    const prev = previousCheckout(ctx.wt, 1);
    if (!prev) fail("fatal: invalid reference: @{-1}");
    ref = prev;
  }
  if (ctx.state.branches[ref] !== undefined) {
    switchTo(ctx, { kind: "branch", name: ref });
    return;
  }
  const guess = guessRemoteBranch(ctx, ref);
  if (guess) {
    const oid = ctx.state.remoteTracking[guess];
    const wt = ctx.wt;
    const oldOid = ctx.headOid();
    requireCleanIndex(ctx);
    const next = twoWayCheckout(ctx.tree(oldOid), ctx.tree(oid), wt.index, wt.workingTree, "checkout");
    const oldLabel = wt.head.kind === "branch" ? wt.head.name : wt.head.oid;
    createBranch(ctx, ref, oid, `refs/remotes/${guess}`);
    trackIfRemote(ctx, ref, guess);
    wt.index = sortedTree(next.index);
    wt.workingTree = sortedTree(next.working);
    ctx.setHead(wt, { kind: "branch", name: ref });
    ctx.logHead(wt, oldOid, oid, `checkout: moving from ${oldLabel} to ${ref}`);
    ctx.out(`Switched to a new branch '${ref}'`);
    return;
  }
  const oid = resolveRev(ctx.state, ctx.actor, ref);
  if (!oid) fail(`fatal: invalid reference: ${name}`);
  if (!allowDetach) {
    ctx.hint("hint: If you want to detach HEAD at the commit, try again with the --detach option.");
    fail(`fatal: a branch is expected, got commit '${name}'`);
  }
  switchTo(ctx, { kind: "detached", oid, label: ref });
}

export function switchCommand(ctx: Ctx, args: string[]): void {
  const p = parseArgs("switch", args, {
    "-c": { value: true },
    "--create": { value: true, alias: "-c" },
    "-C": { value: true },
    "--force-create": { value: true, alias: "-C" },
    "-d": {},
    "--detach": { alias: "-d" },
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  const wt = ctx.wt;
  if (wt.inProgress?.kind === "merge") {
    fail("fatal: cannot switch branch while merging", 'Consider "git merge --quit" or "git worktree add".');
  }
  const create = value(p, "-c") ?? value(p, "-C");
  if (create !== undefined) {
    if (p.positional.length > 1) fail("fatal: only one reference expected");
    createAndSwitch(ctx, create, p.positional[0], flag(p, "-C"));
    return;
  }
  if (flag(p, "-d")) {
    const rev = p.positional[0] ?? "HEAD";
    const oid = resolveRev(ctx.state, ctx.actor, rev);
    if (!oid) fail(`fatal: invalid reference: ${rev}`);
    switchTo(ctx, { kind: "detached", oid, label: rev });
    return;
  }
  if (p.positional.length !== 1) fail("fatal: missing branch or commit argument");
  switchToName(ctx, p.positional[0], false);
}

function checkoutPaths(ctx: Ctx, rev: string | null, specs: string[]): void {
  const wt = ctx.wt;
  if (specs.length === 0) fail("fatal: you must specify path(s) to restore");
  if (rev === null) {
    const { matched, unmatched } = select(specs, [...Object.keys(wt.index), ...Object.keys(wt.conflicts)]);
    if (unmatched.length) fail(`error: pathspec '${unmatched[0]}' did not match any file(s) known to git`);
    const unmerged = matched.filter((m) => wt.conflicts[m]);
    if (unmerged.length) fail(...unmerged.map((m) => `error: path '${m}' is unmerged`));
    const working = { ...wt.workingTree };
    for (const m of matched) working[m] = wt.index[m];
    wt.workingTree = sortedTree(working);
    ctx.out(`Updated ${matched.length} path${matched.length === 1 ? "" : "s"} from the index`);
    return;
  }
  const oid = resolveRev(ctx.state, ctx.actor, rev);
  if (!oid) fail(`fatal: invalid reference: ${rev}`);
  const tree = ctx.tree(oid);
  const { matched, unmatched } = select(specs, Object.keys(tree));
  if (unmatched.length) fail(`error: pathspec '${unmatched[0]}' did not match any file(s) known to git`);
  const index = { ...wt.index };
  const working = { ...wt.workingTree };
  const conflicts = { ...wt.conflicts };
  for (const m of matched) {
    index[m] = tree[m];
    working[m] = tree[m];
    delete conflicts[m];
  }
  wt.index = sortedTree(index);
  wt.workingTree = sortedTree(working);
  wt.conflicts = conflicts;
  ctx.out(`Updated ${matched.length} path${matched.length === 1 ? "" : "s"} from ${shortOid(oid)}`);
}

export function checkout(ctx: Ctx, args: string[]): void {
  const p = parseArgs("checkout", args, {
    "-b": { value: true },
    "-B": { value: true },
    "--detach": {},
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  const create = value(p, "-b") ?? value(p, "-B");
  if (create !== undefined) {
    if (p.afterDashes) fail("fatal: Cannot update paths and switch to branch at the same time.");
    if (p.positional.length > 1) fail("fatal: only one reference expected");
    createAndSwitch(ctx, create, p.positional[0], flag(p, "-B"));
    return;
  }
  if (p.afterDashes) {
    if (p.positional.length > 1) fail("fatal: only one reference expected");
    checkoutPaths(ctx, p.positional[0] ?? null, p.afterDashes);
    return;
  }
  if (flag(p, "--detach")) {
    const rev = p.positional[0] ?? "HEAD";
    const oid = resolveRev(ctx.state, ctx.actor, rev);
    if (!oid) fail(`fatal: invalid reference: ${rev}`);
    switchTo(ctx, { kind: "detached", oid, label: rev });
    return;
  }
  if (p.positional.length === 0) fail("fatal: you must specify a branch or path to check out");
  const [first, ...rest] = p.positional;
  const isRev =
    first === "-" ||
    ctx.state.branches[first] !== undefined ||
    resolveRev(ctx.state, ctx.actor, first) !== null ||
    (rest.length === 0 && guessRemoteBranch(ctx, first) !== null);
  if (isRev && rest.length === 0) {
    switchToName(ctx, first, true);
    return;
  }
  if (isRev) {
    checkoutPaths(ctx, first, rest);
    return;
  }
  checkoutPaths(ctx, null, p.positional);
}

export function restore(ctx: Ctx, args: string[]): void {
  const p = parseArgs("restore", args, {
    "-S": {},
    "--staged": { alias: "-S" },
    "-W": {},
    "--worktree": { alias: "-W" },
    "-s": { value: true },
    "--source": { value: true, alias: "-s" },
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  const wt = ctx.wt;
  const specs = [...p.positional, ...(p.afterDashes ?? [])];
  if (specs.length === 0) fail("fatal: you must specify path(s) to restore");
  const staged = flag(p, "-S");
  const worktree = flag(p, "-W") || !staged;
  const sourceRev = value(p, "-s");

  let source: FileTree;
  let sourceIsIndex = false;
  if (sourceRev !== undefined) {
    source = ctx.tree(resolveOrFail(ctx, sourceRev));
  } else if (staged) {
    const head = ctx.headOid();
    if (!head) fail("fatal: could not resolve HEAD");
    source = ctx.tree(head);
  } else {
    source = wt.index;
    sourceIsIndex = true;
  }

  const tracked = [...Object.keys(wt.index), ...Object.keys(wt.conflicts)];
  const { matched, unmatched } = select(specs, [...Object.keys(source), ...tracked]);
  if (unmatched.length) fail(`error: pathspec '${unmatched[0]}' did not match any file(s) known to git`);

  if (worktree && !staged) {
    const unmerged = matched.filter((m) => wt.conflicts[m]);
    if (unmerged.length) fail(...unmerged.map((m) => `error: path '${m}' is unmerged`));
  }

  const index = { ...wt.index };
  const conflicts = { ...wt.conflicts };
  const working = { ...wt.workingTree };
  for (const path of matched) {
    const content = sourceIsIndex ? get(wt.index, path) : get(source, path);
    if (staged) {
      if (content === undefined) delete index[path];
      else index[path] = content;
      delete conflicts[path];
    }
    if (worktree) {
      // An untracked file is never deleted by restore.
      if (content === undefined) {
        if (tracked.includes(path)) delete working[path];
      } else {
        working[path] = content;
      }
    }
  }
  wt.index = sortedTree(index);
  wt.conflicts = conflicts;
  wt.workingTree = sortedTree(working);
}

