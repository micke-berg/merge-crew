// git worktree add, git worktree list

import { flag, parseArgs, value } from "../args";
import { fail, notSupported, type Ctx } from "../context";
import { shortOid } from "../objects";
import { resolveRev } from "../revisions";
import type { HeadRef, Oid, Worktree } from "../types";
import { checkNewBranchName, createBranch } from "./branch";

/** Resolve `path` against `cwd` like a POSIX shell would, e.g. "/repo" + "../crew/blaze" = "/crew/blaze". */
export function resolvePath(cwd: string, path: string): string {
  const parts = path.startsWith("/") ? [] : cwd.split("/").filter(Boolean);
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function add(ctx: Ctx, args: string[]): void {
  const p = parseArgs("worktree add", args, {
    "-b": { value: true },
    "-B": { value: true },
    "--detach": {},
    "-d": { alias: "--detach" },
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  const [pathArg, commitish, ...extra] = p.positional;
  if (!pathArg || extra.length) fail("usage: git worktree add [-b <new-branch>] <path> [<commit-ish>]");
  const path = resolvePath(ctx.wt.path, pathArg);
  const actor = path.split("/").filter(Boolean).pop();
  if (!actor) fail(`fatal: '${pathArg}' is not a valid worktree path`);
  if (ctx.state.worktrees[actor] || Object.values(ctx.state.worktrees).some((w) => w.path === path)) {
    fail(`fatal: '${path}' already exists`);
  }

  const resolveStart = (rev: string): Oid => {
    const oid = resolveRev(ctx.state, ctx.actor, rev);
    if (!oid) fail(`fatal: invalid reference: ${rev}`);
    return oid;
  };

  const newBranch = value(p, "-b") ?? value(p, "-B");
  let head: HeadRef;
  let oid: Oid;
  let created: { name: string; start: string } | null = null;
  if (newBranch !== undefined) {
    checkNewBranchName(ctx, newBranch, flag(p, "-B"));
    const user = ctx.worktreeUsing(newBranch);
    if (user) fail(`fatal: '${newBranch}' is already used by worktree at '${user.path}'`);
    oid = resolveStart(commitish ?? "HEAD");
    head = { kind: "branch", name: newBranch };
    created = { name: newBranch, start: commitish ?? "HEAD" };
    ctx.out(`Preparing worktree (new branch '${newBranch}')`);
  } else if (flag(p, "--detach")) {
    oid = resolveStart(commitish ?? "HEAD");
    head = { kind: "detached", oid };
    ctx.out(`Preparing worktree (detached HEAD ${shortOid(oid)})`);
  } else {
    // No branch given: check out a branch named like the folder, creating it from HEAD if needed.
    const name = commitish ?? actor;
    if (ctx.state.branches[name] !== undefined) {
      const user = ctx.worktreeUsing(name);
      if (user) fail(`fatal: '${name}' is already used by worktree at '${user.path}'`);
      oid = ctx.state.branches[name];
      head = { kind: "branch", name };
      ctx.out(`Preparing worktree (checking out '${name}')`);
    } else if (commitish !== undefined) {
      oid = resolveStart(commitish);
      head = { kind: "detached", oid };
      ctx.out(`Preparing worktree (detached HEAD ${shortOid(oid)})`);
    } else {
      checkNewBranchName(ctx, name, false);
      oid = resolveStart("HEAD");
      head = { kind: "branch", name };
      created = { name, start: "HEAD" };
      ctx.out(`Preparing worktree (new branch '${name}')`);
    }
  }

  if (created) createBranch(ctx, created.name, oid, created.start);
  const tree = ctx.tree(oid);
  const wt: Worktree = {
    actor,
    path,
    head,
    index: { ...tree },
    conflicts: {},
    workingTree: { ...tree },
    // Git logs the new HEAD, then the "reset --hard" it runs to fill a branch checkout.
    headReflog: [{ oid, previous: null, message: "", time: ctx.time }],
    inProgress: null,
  };
  if (head.kind === "branch") wt.headReflog.push({ oid, previous: oid, message: "reset: moving to HEAD", time: ctx.time });
  ctx.state.worktrees[actor] = wt;
  ctx.emit({ type: "worktree-added", actor, path, head });
  ctx.out(`HEAD is now at ${ctx.oneline(oid)}`);
}

function list(ctx: Ctx): void {
  const all = Object.values(ctx.state.worktrees).sort((a, b) =>
    a.actor === "player" ? -1 : b.actor === "player" ? 1 : a.path < b.path ? -1 : 1,
  );
  const width = Math.max(...all.map((w) => w.path.length));
  for (const w of all) {
    const oid = w.head.kind === "detached" ? w.head.oid : (ctx.state.branches[w.head.name] ?? null);
    const where = w.head.kind === "branch" ? `[${w.head.name}]` : "(detached HEAD)";
    ctx.out(`${w.path.padEnd(width)}  ${oid ? shortOid(oid) : "0000000"} ${where}`);
  }
}

export function worktree(ctx: Ctx, args: string[]): void {
  const [sub, ...rest] = args;
  if (sub === "add") add(ctx, rest);
  else if (sub === "list") list(ctx);
  else if (sub === undefined) fail("usage: git worktree add <path> [<commit-ish>] | git worktree list");
  else notSupported(`git worktree ${sub}`);
}
