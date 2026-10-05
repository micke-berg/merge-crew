// git cherry-pick and git revert

import { flag, parseArgs } from "../args";
import { fail, type Ctx } from "../context";
import { changedPaths, shortOid, subject } from "../objects";
import { ancestors, resolveRev, walk } from "../revisions";
import {
  applyChange,
  commitLabel,
  commitOnHead,
  indexMatchesHead,
  pickState,
  resetHardToHead,
  resetMerge,
  revertMessage,
  type PickInProgress,
} from "../sequencer";
import type { InProgress, Oid } from "../types";
import { unmergedFailure } from "./commit";

type Kind = "cherry-pick" | "revert";

function failed(kind: Kind, ...lines: string[]): never {
  fail(...lines, `fatal: ${kind} failed`);
}

/** The commit message a pick or revert of `oid` gets. */
export function pickMessage(ctx: Ctx, kind: Kind, oid: Oid): string {
  return kind === "cherry-pick" ? ctx.state.commits[oid].message : revertMessage(ctx, oid);
}

/** Expand the arguments into commits: single revisions and A..B ranges, oldest first. */
function collect(ctx: Ctx, kind: Kind, revs: string[]): Oid[] {
  const out: Oid[] = [];
  for (const rev of revs) {
    const dots = rev.indexOf("..");
    if (dots !== -1 && !rev.includes("...")) {
      const from = resolveRev(ctx.state, ctx.actor, rev.slice(0, dots) || "HEAD");
      const to = resolveRev(ctx.state, ctx.actor, rev.slice(dots + 2) || "HEAD");
      if (!from || !to) failed(kind, `fatal: bad revision '${rev}'`);
      const range = walk(ctx.state, [to], ancestors(ctx.state, from)).reverse();
      out.push(...(kind === "revert" ? range.reverse() : range).map((c) => c.oid));
      continue;
    }
    const oid = resolveRev(ctx.state, ctx.actor, rev);
    if (!oid) failed(kind, `fatal: bad revision '${rev}'`);
    out.push(oid);
  }
  if (out.length === 0) failed(kind, "error: empty commit set passed");
  for (const oid of out) {
    if (ctx.state.commits[oid].parents.length > 1) {
      failed(kind, `error: commit ${oid} is a merge but no -m option was given.`);
    }
  }
  return out;
}

function conflictHints(ctx: Ctx, kind: Kind, oid: Oid): void {
  const verb = kind === "cherry-pick" ? "apply" : "revert";
  ctx.err(`error: could not ${verb} ${shortOid(oid)}... ${subject(ctx.state.commits[oid].message)}`);
  ctx.hint(
    "hint: After resolving the conflicts, mark them with",
    'hint: "git add/rm <pathspec>", then run',
    `hint: "git ${kind} --continue".`,
    `hint: You can instead skip this commit with "git ${kind} --skip".`,
    `hint: To abort and get back to the state before "git ${kind}",`,
    `hint: run "git ${kind} --abort".`,
  );
}

function emptyHint(ctx: Ctx, kind: Kind): void {
  ctx.err(
    `The previous ${kind} is now empty, possibly due to conflict resolution.`,
    "If you wish to commit it anyway, use:",
    "",
    "    git commit --allow-empty",
    "",
    `Otherwise, please use 'git ${kind} --skip'`,
  );
}

function stop(ctx: Ctx, record: PickInProgress): void {
  ctx.wt.inProgress = record as InProgress;
  ctx.emit({ type: "operation", actor: ctx.actor, kind: record.kind, phase: "stopped" });
}

/** Apply each commit in turn, committing as it goes, until done or a conflict stops it. */
function runPicks(ctx: Ctx, kind: Kind, todo: Oid[], head: Oid | null): void {
  const wt = ctx.wt;
  const queue = [...todo];
  while (queue.length) {
    const oid = queue.shift() as Oid;
    const commit = ctx.state.commits[oid];
    const parentTree = ctx.tree(commit.parents[0] ?? null);
    const conflicted =
      kind === "cherry-pick"
        ? applyChange(ctx, parentTree, commit.tree, commitLabel(ctx, oid))
        : applyChange(ctx, commit.tree, parentTree, `parent of ${commitLabel(ctx, oid)}`);
    const record: PickInProgress = { kind, oid, todo: [...queue], head };
    if (conflicted.length) {
      ctx.emit({ type: "conflict", actor: ctx.actor, paths: conflicted });
      conflictHints(ctx, kind, oid);
      stop(ctx, record);
      return;
    }
    if (indexMatchesHead(ctx)) {
      emptyHint(ctx, kind);
      stop(ctx, record);
      return;
    }
    const message = pickMessage(ctx, kind, oid);
    commitOnHead(ctx, {
      message,
      author: kind === "cherry-pick" ? commit.author : ctx.actor,
      reason: kind,
      reflog: `${kind}: ${subject(message)}`,
    });
  }
  if (wt.inProgress) {
    wt.inProgress = null;
    ctx.emit({ type: "operation", actor: ctx.actor, kind, phase: "completed" });
  }
}

function noSequence(kind: Kind): never {
  failed(kind, "error: no cherry-pick or revert in progress");
}

function continuePicks(ctx: Ctx, kind: Kind): void {
  const state = pickState(ctx);
  if (!state) noSequence(kind);
  if (Object.keys(ctx.wt.conflicts).length) unmergedFailure(ctx, "Committing");
  if (indexMatchesHead(ctx)) {
    emptyHint(ctx, state.kind);
    fail(`fatal: ${kind} failed`);
  }
  const message = pickMessage(ctx, state.kind, state.oid);
  commitOnHead(ctx, {
    message,
    author: state.kind === "cherry-pick" ? ctx.state.commits[state.oid].author : ctx.actor,
    reason: state.kind,
    reflog: `${state.kind === "cherry-pick" ? "commit (cherry-pick)" : "commit"}: ${subject(message)}`,
  });
  runPicks(ctx, state.kind, state.todo ?? [], state.head ?? null);
}

function skipPick(ctx: Ctx, kind: Kind): void {
  const state = pickState(ctx);
  if (!state) noSequence(kind);
  resetHardToHead(ctx);
  const head = ctx.headOid();
  if (head) ctx.advanceHead(head, "reset", "reset: moving to HEAD");
  runPicks(ctx, state.kind, state.todo ?? [], state.head ?? null);
}

function abortPick(ctx: Ctx, kind: Kind): void {
  const state = pickState(ctx);
  if (!state) noSequence(kind);
  const target = state.head ?? ctx.headOid();
  resetMerge(ctx, target);
  ctx.wt.inProgress = null;
  ctx.emit({ type: "operation", actor: ctx.actor, kind: state.kind, phase: "aborted" });
  if (target) ctx.advanceHead(target, "reset", `reset: moving to ${target}`);
}

function pickCommand(ctx: Ctx, kind: Kind, args: string[]): void {
  const p = parseArgs(kind, args, {
    "--continue": {},
    "--abort": {},
    "--skip": {},
    "--no-edit": {},
    "-e": {},
    "--edit": { alias: "-e" },
  });
  if (flag(p, "--continue")) return continuePicks(ctx, kind);
  if (flag(p, "--skip")) return skipPick(ctx, kind);
  if (flag(p, "--abort")) return abortPick(ctx, kind);
  const wt = ctx.wt;
  const action = kind === "cherry-pick" ? "Cherry-picking" : "Reverting";
  if (Object.keys(wt.conflicts).length) {
    ctx.err(`error: ${action} is not possible because you have unmerged files.`);
    ctx.hint("hint: Fix them up in the work tree, and then use 'git add/rm <file>'");
    ctx.hint("hint: as appropriate to mark resolution and make a commit.");
    failed(kind);
  }
  if (wt.inProgress) {
    if (wt.inProgress.kind === "cherry-pick" || wt.inProgress.kind === "revert") {
      ctx.err(`error: ${wt.inProgress.kind} is already in progress`);
      ctx.hint(`hint: try "git ${kind} (--continue | --abort | --quit)"`);
      failed(kind);
    }
    failed(kind, `error: a ${wt.inProgress.kind} is in progress`);
  }
  if (p.positional.length === 0) {
    fail(`usage: git ${kind} [--edit] [-n] [-m <parent-number>] [-s] [-x] [--ff] <commit>...`);
  }
  const todo = collect(ctx, kind, p.positional);
  const head = ctx.headOid();
  if (changedPaths(ctx.headTree(), wt.index).length) {
    ctx.err(`error: your local changes would be overwritten by ${kind}.`);
    ctx.hint("hint: commit your changes or stash them to proceed.");
    failed(kind);
  }
  ctx.emit({ type: "operation", actor: ctx.actor, kind, phase: "started" });
  wt.inProgress = { kind, oid: todo[0] } as InProgress;
  runPicks(ctx, kind, todo, head);
}

export function cherryPick(ctx: Ctx, args: string[]): void {
  pickCommand(ctx, "cherry-pick", args);
}

export function revert(ctx: Ctx, args: string[]): void {
  pickCommand(ctx, "revert", args);
}
