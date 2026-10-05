// git rebase (non-interactive, the default merge backend), also used by git pull --rebase.

import { flag, parseArgs, value } from "../args";
import { fail, notSupported, twoWayCheckout, type Ctx } from "../context";
import { createCommit, own, shortOid, sortedTree, subject, treesEqual } from "../objects";
import { ancestors, forkPoint, mergeBases, resolveRev, walk } from "../revisions";
import {
  applyChange,
  commitLabel,
  indexMatchesHead,
  rebaseState,
  requireCleanTree,
  resetHardToHead,
  resetMerge,
  unstagedPaths,
  type RebaseInProgress,
} from "../sequencer";
import type { Oid } from "../types";
import { patchId } from "../unified";
import { unmergedFailure } from "./commit";

export type RebaseStart = {
  upstream: Oid;
  onto: Oid;
  /** How the start line names onto: "rebase (start): checkout <ontoLabel>". */
  ontoLabel: string;
  /** The branch argument, if one was given. */
  branchArg: string | null;
  /** Reflog action: "rebase", or the pull command line for pull --rebase. */
  action: string;
};

function pickReflog(action: string, oid: Oid, ctx: Ctx): string {
  return `${action} (pick): ${subject(ctx.state.commits[oid].message)}`;
}

/** Point HEAD (detached) at a commit with a reflog line. */
function moveDetached(ctx: Ctx, to: Oid, message: string): void {
  const wt = ctx.wt;
  ctx.logHead(wt, ctx.headOid(), to, message);
  ctx.setHead(wt, { kind: "detached", oid: to });
}

function finish(ctx: Ctx, state: Readonly<RebaseInProgress>, action: string): void {
  const wt = ctx.wt;
  const head = ctx.headOid() as Oid;
  wt.inProgress = null;
  if (state.branch) {
    ctx.updateBranch(state.branch, head, "rebase", `${action} (finish): refs/heads/${state.branch} onto ${state.onto}`);
    ctx.setHead(wt, { kind: "branch", name: state.branch });
    ctx.logHead(wt, head, head, `${action} (finish): returning to refs/heads/${state.branch}`);
    ctx.out(`Successfully rebased and updated refs/heads/${state.branch}.`);
  } else {
    ctx.out("Successfully rebased and updated detached HEAD.");
  }
  ctx.emit({ type: "operation", actor: ctx.actor, kind: "rebase", phase: "completed" });
}

/**
 * Replay the remaining commits. Stops on a conflict, finishes when the list is empty.
 * `state` is never changed: each step works out the next todo/done pair, and a stop stores a new
 * in-progress record with exactly that pair.
 */
function runTodo(ctx: Ctx, state: Readonly<RebaseInProgress>, action: string): void {
  const wt = ctx.wt;
  let todo: readonly Oid[] = state.todo;
  let done: readonly Oid[] = state.done;
  while (todo.length) {
    const oid = todo[0];
    todo = todo.slice(1);
    done = [...done, oid];
    const commit = ctx.state.commits[oid];
    const head = ctx.headOid() as Oid;
    if (commit.parents[0] === head) {
      // Already in place: move HEAD forward without making a new commit.
      const next = twoWayCheckout(ctx.tree(head), commit.tree, wt.index, wt.workingTree, "checkout");
      wt.index = sortedTree(next.index);
      wt.workingTree = sortedTree(next.working);
      moveDetached(ctx, oid, `${action}: fast-forward`);
      continue;
    }
    const parentTree = ctx.tree(commit.parents[0] ?? null);
    const conflicted = applyChange(ctx, parentTree, commit.tree, commitLabel(ctx, oid));
    if (conflicted.length) {
      wt.inProgress = { ...state, todo: [...todo], done: [...done] };
      const line = `${shortOid(oid)}... ${subject(commit.message)}`;
      ctx.emit({ type: "conflict", actor: ctx.actor, paths: conflicted });
      ctx.emit({ type: "operation", actor: ctx.actor, kind: "rebase", phase: "stopped" });
      ctx.err(`error: could not apply ${line}`);
      ctx.hint(
        "hint: Resolve all conflicts manually, mark them as resolved with",
        'hint: "git add/rm <conflicted_files>", then run "git rebase --continue".',
        'hint: You can instead skip this commit: run "git rebase --skip".',
        'hint: To abort and get back to the state before "git rebase", run "git rebase --abort".',
      );
      ctx.err(`Could not apply ${line}`);
      return;
    }
    // A commit whose change is already there is dropped; one that was empty to begin with is kept.
    if (indexMatchesHead(ctx) && !treesEqual(parentTree, commit.tree)) continue;
    const created = createCommit(ctx.state, {
      parents: [head],
      message: commit.message,
      tree: wt.index,
      author: commit.author,
      time: ctx.time,
    });
    ctx.emit({ type: "commit-created", actor: ctx.actor, oid: created.oid, parents: created.parents, branch: null });
    moveDetached(ctx, created.oid, pickReflog(action, oid, ctx));
  }
  finish(ctx, state, action);
}

/** Start a rebase. Shared by `git rebase` and `git pull --rebase`. */
export function startRebase(ctx: Ctx, opts: RebaseStart): void {
  const wt = ctx.wt;
  let branch: string | null;
  let head: Oid;
  if (opts.branchArg !== null) {
    const name = opts.branchArg.replace(/^refs\/heads\//, "");
    const existing = own(ctx.state.branches, name);
    if (existing !== undefined) {
      branch = name;
      head = existing;
      const user = ctx.worktreeUsing(name, ctx.actor);
      if (user) fail(`fatal: '${name}' is already used by worktree at '${user.path}'`);
    } else {
      const oid = resolveRev(ctx.state, ctx.actor, opts.branchArg);
      if (!oid) fail(`fatal: no such branch/commit '${opts.branchArg}'`);
      branch = null;
      head = oid;
    }
  } else {
    const current = ctx.headOid();
    if (!current) fail("fatal: invalid upstream 'HEAD'");
    head = current;
    branch = wt.head.kind === "branch" ? wt.head.name : null;
  }
  requireCleanTree(ctx, "rebase");

  // Already based on onto with nothing to replay: git only switches to the branch, if one was named.
  const base = mergeBases(ctx.state, opts.onto, head);
  const upstreamBase = mergeBases(ctx.state, opts.upstream, head);
  const linear = walk(ctx.state, [head], ancestors(ctx.state, opts.onto)).every((c) => c.parents.length <= 1);
  if (base.length === 1 && base[0] === opts.onto && upstreamBase.length === 1 && upstreamBase[0] === opts.onto && linear) {
    if (opts.branchArg !== null) {
      const from = ctx.headOid();
      const next = twoWayCheckout(ctx.tree(from), ctx.tree(head), wt.index, wt.workingTree, "checkout");
      wt.index = sortedTree(next.index);
      wt.workingTree = sortedTree(next.working);
      const message = `rebase: checkout ${opts.branchArg}`;
      // git updates the branch through HEAD and then repoints HEAD, logging HEAD twice when it
      // already was on that branch.
      const already = branch !== null && wt.head.kind === "branch" && wt.head.name === branch;
      if (already) ctx.logHead(wt, from, head, message);
      ctx.setHead(wt, branch ? { kind: "branch", name: branch } : { kind: "detached", oid: head });
      ctx.logHead(wt, from, head, message);
    }
    ctx.out(branch ? `Current branch ${branch} is up to date.` : "HEAD is up to date.");
    return;
  }

  // The commits to replay: on the branch but not upstream, oldest first, without merges, and
  // without those whose change upstream already has.
  const excluded = ancestors(ctx.state, opts.upstream);
  let todo = walk(ctx.state, [head], excluded)
    .reverse()
    .filter((c) => c.parents.length <= 1);
  const upstreamSide = walk(ctx.state, [opts.upstream], ancestors(ctx.state, head)).filter((c) => c.parents.length <= 1);
  if (upstreamSide.length) {
    const applied = new Set(upstreamSide.map((c) => patchId(ctx.tree(c.parents[0] ?? null), c.tree)));
    const skipped = todo.filter((c) => applied.has(patchId(ctx.tree(c.parents[0] ?? null), c.tree)));
    if (skipped.length) {
      for (const c of skipped) ctx.err(`warning: skipped previously applied commit ${shortOid(c.oid)}`);
      ctx.hint("hint: use --reapply-cherry-picks to include skipped commits");
      todo = todo.filter((c) => !skipped.includes(c));
    }
  }
  // Commits that already sit on onto are kept as they are (git's skip_unnecessary_picks).
  let start = opts.onto;
  let ids = todo.map((c) => c.oid);
  while (ids.length && ctx.state.commits[ids[0]].parents.length === 1 && ctx.state.commits[ids[0]].parents[0] === start) {
    start = ids[0];
    ids = ids.slice(1);
  }

  const from = ctx.headOid();
  const next = twoWayCheckout(ctx.tree(from), ctx.tree(start), wt.index, wt.workingTree, "checkout");
  wt.index = sortedTree(next.index);
  wt.workingTree = sortedTree(next.working);
  ctx.emit({ type: "operation", actor: ctx.actor, kind: "rebase", phase: "started" });
  moveDetached(ctx, start, `${opts.action} (start): checkout ${opts.ontoLabel}`);
  const state: RebaseInProgress = { kind: "rebase", onto: opts.onto, todo: ids, done: [], origHead: head, branch };
  runTodo(ctx, state, opts.action);
}

function noRebase(): never {
  fail("fatal: no rebase in progress");
}

function continueRebase(ctx: Ctx): void {
  const state = rebaseState(ctx);
  if (!state) noRebase();
  const wt = ctx.wt;
  const conflicted = Object.keys(wt.conflicts).sort();
  if (conflicted.length) {
    fail(
      ...conflicted.map((p) => `${p}: needs merge`),
      "You must edit all merge conflicts and then",
      "mark them as resolved using git add",
    );
  }
  if (unstagedPaths(ctx).length) {
    fail("error: cannot rebase: You have unstaged changes.", "error: Please commit or stash them.");
  }
  const stopped = state.done[state.done.length - 1];
  if (stopped && !indexMatchesHead(ctx)) {
    const original = ctx.state.commits[stopped];
    const head = ctx.headOid() as Oid;
    const created = createCommit(ctx.state, {
      parents: [head],
      message: original.message,
      tree: wt.index,
      author: original.author,
      time: ctx.time,
    });
    ctx.emit({ type: "commit-created", actor: ctx.actor, oid: created.oid, parents: created.parents, branch: null });
    moveDetached(ctx, created.oid, `rebase (continue): ${subject(original.message)}`);
    ctx.out(`[detached HEAD ${shortOid(created.oid)}] ${subject(original.message)}`);
  }
  runTodo(ctx, state, "rebase");
}

function skipRebase(ctx: Ctx): void {
  const state = rebaseState(ctx);
  if (!state) noRebase();
  resetHardToHead(ctx);
  runTodo(ctx, state, "rebase");
}

function abortRebase(ctx: Ctx): void {
  const state = rebaseState(ctx);
  if (!state) noRebase();
  const wt = ctx.wt;
  const from = ctx.headOid();
  resetMerge(ctx, state.origHead);
  wt.inProgress = null;
  if (state.branch) {
    ctx.setHead(wt, { kind: "branch", name: state.branch });
    ctx.logHead(wt, from, state.origHead, `rebase (abort): returning to refs/heads/${state.branch}`);
  } else {
    ctx.logHead(wt, from, state.origHead, `rebase (abort): returning to ${state.origHead}`);
    ctx.setHead(wt, { kind: "detached", oid: state.origHead });
  }
  ctx.emit({ type: "operation", actor: ctx.actor, kind: "rebase", phase: "aborted" });
}

export function rebase(ctx: Ctx, args: string[]): void {
  if (args.some((a) => a === "-i" || a === "--interactive")) {
    notSupported("git rebase -i (interactive rebase)");
  }
  const p = parseArgs("rebase", args, {
    "--onto": { value: true },
    "--continue": {},
    "--abort": {},
    "--skip": {},
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  if (flag(p, "--continue")) return continueRebase(ctx);
  if (flag(p, "--abort")) return abortRebase(ctx);
  if (flag(p, "--skip")) return skipRebase(ctx);
  const wt = ctx.wt;
  if (wt.inProgress?.kind === "rebase") {
    fail(
      "fatal: It seems that there is already a rebase-merge directory, and",
      "I wonder if you are in the middle of another rebase.  If that is the",
      "case, please try",
      "\tgit rebase (--continue | --abort | --skip)",
    );
  }
  if (wt.inProgress) fail(`fatal: a ${wt.inProgress.kind} is in progress`);
  if (Object.keys(wt.conflicts).length) unmergedFailure(ctx, "Rebasing");
  if (p.positional.length > 2) fail("usage: git rebase [--onto <newbase>] [<upstream> [<branch>]]");
  let [upstreamArg] = p.positional;
  const branchArg = p.positional[1] ?? null;
  if (upstreamArg === undefined) {
    const current = wt.head.kind === "branch" ? wt.head.name : null;
    const up = current ? own(ctx.state.upstreams, current) : undefined;
    if (!up) {
      fail(
        "There is no tracking information for the current branch.",
        "Please specify which branch you want to rebase against.",
        "",
        "    git rebase '<branch>'",
        "",
        "If you wish to set tracking information for this branch you can do so with:",
        "",
        `    git branch --set-upstream-to=<remote>/<branch> ${current ?? "<branch>"}`,
      );
    }
    upstreamArg = `${up.remote}/${up.branch}`;
  }
  const named = resolveRev(ctx.state, ctx.actor, upstreamArg);
  if (!named) fail(`fatal: invalid upstream '${upstreamArg}'`);
  // Without an upstream argument git uses --fork-point: commits the upstream once had and then
  // dropped (a force push) are not replayed.
  const head = ctx.headOid();
  const fork = p.positional.length === 0 && head ? forkPoint(ctx.state, upstreamArg, head) : null;
  const upstream = fork ?? named;
  const ontoArg = value(p, "--onto");
  let onto = named;
  if (ontoArg !== undefined) {
    const resolved = resolveRev(ctx.state, ctx.actor, ontoArg);
    if (!resolved) fail(`fatal: Does not point to a valid commit '${ontoArg}'`);
    onto = resolved;
  }
  startRebase(ctx, { upstream, onto, ontoLabel: ontoArg ?? upstreamArg, branchArg, action: "rebase" });
}
