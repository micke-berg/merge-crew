// git commit

import { flag, parseArgs } from "../args";
import { fail, type Ctx } from "../context";
import { cleanupMessage, createCommit, shortOid, subject, treesEqual } from "../objects";
import type { Oid } from "../types";
import { pickState, type PickInProgress } from "../sequencer";
import { stageTracked } from "./files";
import { pickMessage } from "./pick";
import { statusLines } from "./status";

export function unmergedFailure(ctx: Ctx, what: string): never {
  ctx.err(`error: ${what} is not possible because you have unmerged files.`);
  ctx.hint("hint: Fix them up in the work tree, and then use 'git add/rm <file>'");
  ctx.hint("hint: as appropriate to mark resolution and make a commit.");
  fail("fatal: Exiting because of an unresolved conflict.");
}

/** Create a commit from the index. Shared by `git commit` and `git merge --continue`. */
export function commitIndex(
  ctx: Ctx,
  opts: { message?: string; amend?: boolean; allowEmpty?: boolean },
): Oid {
  const wt = ctx.wt;
  if (Object.keys(wt.conflicts).length) unmergedFailure(ctx, "Committing");
  const merge = wt.inProgress?.kind === "merge" ? wt.inProgress : null;
  // A stopped cherry-pick or revert is concluded by a plain commit, with the picked commit's message.
  const pick = pickState(ctx);
  const head = ctx.headOid();
  let parents: Oid[];
  let message = opts.message;

  if (opts.amend) {
    if (merge) fail("fatal: You are in the middle of a merge -- cannot amend.");
    if (pick) fail(`fatal: You are in the middle of a ${pick.kind} -- cannot amend.`);
    if (!head) fail("fatal: You have nothing to amend.");
    const old = ctx.state.commits[head];
    parents = [...old.parents];
    if (message === undefined) message = old.message;
    const compareTo = ctx.tree(parents[0] ?? null);
    if (!opts.allowEmpty && parents.length <= 1 && treesEqual(compareTo, wt.index)) {
      fail(
        "You asked to amend the most recent commit, but doing so would make",
        "it empty. You can repeat your command with --allow-empty, or you can",
        'remove the commit entirely with "git reset HEAD^".',
      );
    }
  } else {
    parents = head ? [head] : [];
    if (merge) {
      parents.push(merge.theirs);
      if (message === undefined) message = merge.message;
    } else if (pick) {
      if (message === undefined) message = pickMessage(ctx, pick.kind, pick.oid);
      if (!opts.allowEmpty && treesEqual(ctx.headTree(), wt.index)) fail(...statusLines(ctx, false));
    } else if (!opts.allowEmpty && treesEqual(ctx.headTree(), wt.index)) {
      fail(...statusLines(ctx, false));
    }
  }
  if (message === undefined) {
    fail("Aborting commit due to empty commit message.", "(Merge Crew has no editor: use git commit -m \"message\")");
  }
  message = cleanupMessage(message);
  if (message === "") fail("Aborting commit due to empty commit message.");

  const commit = createCommit(ctx.state, {
    parents,
    message,
    tree: wt.index,
    author: pick?.kind === "cherry-pick" ? ctx.state.commits[pick.oid].author : ctx.actor,
    time: ctx.time,
  });
  const subj = subject(message);
  const kind = opts.amend
    ? "commit (amend)"
    : merge
      ? "commit (merge)"
      : pick?.kind === "cherry-pick"
        ? "commit (cherry-pick)"
        : parents.length === 0
          ? "commit (initial)"
          : "commit";
  const branch = wt.head.kind === "branch" ? wt.head.name : null;
  ctx.emit({ type: "commit-created", actor: ctx.actor, oid: commit.oid, parents: commit.parents, branch });
  ctx.advanceHead(commit.oid, opts.amend ? "amend" : merge ? "merge" : "commit", `${kind}: ${subj}`);
  if (merge || pick) {
    wt.inProgress = null;
    ctx.emit({ type: "operation", actor: ctx.actor, kind: merge ? "merge" : (pick as PickInProgress).kind, phase: "completed" });
  }
  const where = branch ?? "detached HEAD";
  ctx.out(`[${where}${parents.length === 0 ? " (root-commit)" : ""} ${shortOid(commit.oid)}] ${subj}`);
  return commit.oid;
}

export function commit(ctx: Ctx, args: string[]): void {
  const p = parseArgs("commit", args, {
    "-m": { value: true },
    "--message": { value: true, alias: "-m" },
    "-a": {},
    "--all": { alias: "-a" },
    "--amend": {},
    "--allow-empty": {},
    "--no-edit": {},
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  if (p.positional.length || p.afterDashes) fail("Merge Crew supports git commit -m \"message\", with -a, --amend or --allow-empty");
  if (flag(p, "-a")) stageTracked(ctx);
  const messages = p.flags["-m"];
  commitIndex(ctx, {
    message: messages ? messages.join("\n\n") : undefined,
    amend: flag(p, "--amend"),
    allowEmpty: flag(p, "--allow-empty"),
  });
}
