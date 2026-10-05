// git status

import { parseArgs } from "../args";
import type { Ctx } from "../context";
import { shortOid, subject } from "../objects";
import type { InProgress, Oid } from "../types";
import { queries } from "../query";
import { countBetween } from "../revisions";

function trackingLine(ctx: Ctx): string[] {
  const wt = ctx.wt;
  if (wt.head.kind !== "branch") return [];
  const up = ctx.state.upstreams[wt.head.name];
  const head = ctx.headOid();
  if (!up || !head) return [];
  const name = `${up.remote}/${up.branch}`;
  const tracked = ctx.state.remoteTracking[name];
  if (!tracked) return [`Your branch is based on '${name}', but the upstream is gone.`];
  const ahead = countBetween(ctx.state, tracked, head);
  const behind = countBetween(ctx.state, head, tracked);
  const s = (n: number) => (n === 1 ? "commit" : "commits");
  if (ahead && behind) {
    return [`Your branch and '${name}' have diverged,`, `and have ${ahead} and ${behind} different commits each, respectively.`];
  }
  if (ahead) return [`Your branch is ahead of '${name}' by ${ahead} ${s(ahead)}.`];
  if (behind) return [`Your branch is behind '${name}' by ${behind} ${s(behind)}, and can be fast-forwarded.`];
  return [`Your branch is up to date with '${name}'.`];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function rebaseLines(ctx: Ctx, op: Extract<InProgress, { kind: "rebase" }>, conflicts: boolean): string[] {
  const pick = (oid: Oid) => `   pick ${shortOid(oid)} ${subject(ctx.state.commits[oid]?.message ?? "")}`;
  const lines: string[] = [];
  if (op.done.length) {
    lines.push(`Last command${op.done.length === 1 ? "" : "s"} done (${plural(op.done.length, "command")} done):`, ...op.done.slice(-2).map(pick));
  }
  if (op.todo.length) {
    lines.push(`Next command${op.todo.length === 1 ? "" : "s"} to do (${plural(op.todo.length, "remaining command")}):`, ...op.todo.slice(0, 2).map(pick));
  } else {
    lines.push("No commands remaining.");
  }
  const what = op.branch ? `branch '${op.branch}'` : "detached HEAD";
  lines.push(
    `You are currently rebasing ${what} on '${shortOid(op.onto)}'.`,
    conflicts ? '  (fix conflicts and then run "git rebase --continue")' : '  (all conflicts fixed: run "git rebase --continue")',
    '  (use "git rebase --skip" to skip this patch)',
    '  (use "git rebase --abort" to check out the original branch)',
  );
  return lines;
}

/** Readable status text. `full` adds the branch header lines. */
export function statusLines(ctx: Ctx, full = true): string[] {
  const wt = ctx.wt;
  const st = queries.status(ctx.state, ctx.actor);
  const lines: string[] = [];
  const head = ctx.headOid();
  const op = wt.inProgress;
  if (op?.kind === "rebase") lines.push(`interactive rebase in progress; onto ${shortOid(op.onto)}`);
  else if (wt.head.kind === "branch") lines.push(`On branch ${wt.head.name}`);
  else lines.push(`HEAD detached at ${shortOid(wt.head.oid)}`);
  if (full) lines.push(...trackingLine(ctx));
  if (!head) lines.push("", "No commits yet");
  if (wt.inProgress?.kind === "merge") {
    lines.push(
      "",
      st.conflicted.length
        ? "You have unmerged paths.\n  (fix conflicts and run \"git commit\")\n  (use \"git merge --abort\" to abort the merge)"
        : "All conflicts fixed but you are still merging.\n  (use \"git commit\" to conclude merge)",
    );
  }
  if (op?.kind === "rebase") lines.push(...rebaseLines(ctx, op, st.conflicted.length > 0));
  if (op?.kind === "cherry-pick" || op?.kind === "revert") {
    const verb = op.kind === "cherry-pick" ? "cherry-picking" : "reverting";
    lines.push(
      `You are currently ${verb} commit ${shortOid(op.oid)}.`,
      st.conflicted.length
        ? `  (fix conflicts and run "git ${op.kind} --continue")`
        : `  (all conflicts fixed: run "git ${op.kind} --continue")`,
      `  (use "git ${op.kind} --skip" to skip this patch)`,
      `  (use "git ${op.kind} --abort" to cancel the ${op.kind} operation)`,
    );
  }
  const label = { added: "new file:  ", modified: "modified:  ", deleted: "deleted:   " };
  if (st.staged.length) {
    lines.push("", "Changes to be committed:", ...st.staged.map((e) => `\t${label[e.change]} ${e.path}`));
  }
  if (st.conflicted.length) {
    lines.push("", "Unmerged paths:", ...st.conflicted.map((p) => `\tboth modified:   ${p}`));
  }
  if (st.unstaged.length) {
    lines.push("", "Changes not staged for commit:", ...st.unstaged.map((e) => `\t${label[e.change]} ${e.path}`));
  }
  if (st.untracked.length) {
    lines.push("", "Untracked files:", ...st.untracked.map((p) => `\t${p}`));
  }
  lines.push("");
  if (st.staged.length || st.conflicted.length) {
    // Nothing to add: the sections say it all.
    lines.pop();
  } else if (st.unstaged.length) {
    lines.push('no changes added to commit (use "git add" and/or "git commit -a")');
  } else if (st.untracked.length) {
    lines.push('nothing added to commit but untracked files present (use "git add" to track)');
  } else {
    lines.push(head ? "nothing to commit, working tree clean" : 'nothing to commit (create/copy files and use "git add" to track)');
  }
  return lines;
}

export function status(ctx: Ctx, args: string[]): void {
  parseArgs("status", args, { "-s": {}, "--short": { alias: "-s" }, "-b": {}, "--branch": { alias: "-b" } });
  ctx.out(...statusLines(ctx));
}
