// git branch

import { flag, parseArgs, value } from "../args";
import { fail, type Ctx } from "../context";
import { ZERO_OID, has, own, setOwn, shortOid, subject } from "../objects";
import { isAncestor, remoteTrackingKey, resolveRev } from "../revisions";
import type { Oid } from "../types";

/** git check-ref-format rules for a branch name. */
export function validBranchName(name: string): boolean {
  if (!name || name === "HEAD" || name.startsWith("-")) return false;
  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)) return false;
  if (name.includes("..") || name.includes("@{") || name === "@") return false;
  if (name.endsWith("/") || name.endsWith(".") || name.endsWith(".lock") || name.startsWith("/")) return false;
  if (name.includes("//")) return false;
  return name.split("/").every((part) => part !== "" && !part.startsWith("."));
}

export function checkNewBranchName(ctx: Ctx, name: string, force: boolean): void {
  if (!validBranchName(name)) fail(`fatal: '${name}' is not a valid branch name`);
  if (!force && has(ctx.state.branches, name)) fail(`fatal: a branch named '${name}' already exists`);
}

export function resolveOrFail(ctx: Ctx, rev: string): Oid {
  const oid = resolveRev(ctx.state, ctx.actor, rev);
  if (!oid) fail(`fatal: not a valid object name: '${rev}'`);
  return oid;
}

/** Set the upstream when a branch starts from a remote-tracking ref (branch.autoSetupMerge=true). */
export function trackIfRemote(ctx: Ctx, name: string, start: string | undefined): void {
  if (!start) return;
  const key = remoteTrackingKey(ctx.state, start);
  if (!key) return;
  setUpstream(ctx, name, key);
}

export function setUpstream(ctx: Ctx, name: string, trackingKey: string): void {
  const slash = trackingKey.indexOf("/");
  setOwn(ctx.state.upstreams, name, { remote: trackingKey.slice(0, slash), branch: trackingKey.slice(slash + 1) });
  ctx.out(`branch '${name}' set up to track '${trackingKey}'.`);
}

/**
 * Create (or with force, reset) a branch. `startLabel` is what the reflog says it was created from,
 * normally the start point as typed, or "HEAD".
 */
export function createBranch(ctx: Ctx, name: string, oid: Oid, startLabel: string): void {
  const existed = has(ctx.state.branches, name);
  ctx.updateBranch(name, oid, "branch", existed ? `branch: Reset to ${startLabel}` : `branch: Created from ${startLabel}`);
}

function list(ctx: Ctx, opts: { all: boolean; remotes: boolean; verbose: boolean }): void {
  const wt = ctx.wt;
  const line = (marker: string, name: string, oid: Oid) =>
    opts.verbose ? `${marker} ${name} ${shortOid(oid)} ${subject(own(ctx.state.commits, oid)?.message ?? "")}` : `${marker} ${name}`;
  if (!opts.remotes) {
    if (wt.head.kind === "detached") ctx.out(line("*", `(HEAD detached at ${shortOid(wt.head.oid)})`, wt.head.oid));
    for (const name of Object.keys(ctx.state.branches).sort()) {
      const current = wt.head.kind === "branch" && wt.head.name === name;
      const elsewhere = !current && ctx.worktreeUsing(name, ctx.actor);
      ctx.out(line(current ? "*" : elsewhere ? "+" : " ", name, ctx.state.branches[name]));
    }
  }
  if (opts.all || opts.remotes) {
    for (const name of Object.keys(ctx.state.remoteTracking).sort()) {
      ctx.out(line(" ", opts.all ? `remotes/${name}` : name, ctx.state.remoteTracking[name]));
    }
  }
}

function deleteBranches(ctx: Ctx, names: string[], force: boolean): void {
  if (names.length === 0) fail("fatal: branch name required");
  const errors: string[] = [];
  const hints: string[] = [];
  for (const name of names) {
    const oid = own(ctx.state.branches, name);
    if (oid === undefined) {
      errors.push(`error: branch '${name}' not found`);
      continue;
    }
    const user = ctx.worktreeUsing(name);
    if (user) {
      errors.push(`error: cannot delete branch '${name}' used by worktree at '${user.path}'`);
      continue;
    }
    if (!force) {
      const up = own(ctx.state.upstreams, name);
      const upOid = up ? own(ctx.state.remoteTracking, `${up.remote}/${up.branch}`) : undefined;
      const reference = upOid ?? ctx.headOid();
      if (!reference || !isAncestor(ctx.state, oid, reference)) {
        errors.push(`error: the branch '${name}' is not fully merged`);
        hints.push(`hint: If you are sure you want to delete it, run 'git branch -D ${name}'`);
        continue;
      }
    }
    delete ctx.state.branches[name];
    delete ctx.state.branchReflogs[name];
    delete ctx.state.upstreams[name];
    ctx.emit({ type: "branch-deleted", actor: ctx.actor, name, oid });
    ctx.out(`Deleted branch ${name} (was ${shortOid(oid)}).`);
  }
  if (errors.length) {
    for (const h of hints) ctx.hint(h);
    fail(...errors);
  }
}

function rename(ctx: Ctx, args: string[], force: boolean): void {
  const wt = ctx.wt;
  let oldName: string;
  let newName: string;
  if (args.length === 1) {
    if (wt.head.kind !== "branch") fail("fatal: cannot rename the current branch while not on any branch");
    oldName = wt.head.name;
    newName = args[0];
  } else if (args.length === 2) {
    [oldName, newName] = args;
  } else {
    fail("fatal: branch name required");
  }
  const oid = own(ctx.state.branches, oldName);
  const unbornCurrent = oid === undefined && wt.head.kind === "branch" && wt.head.name === oldName;
  if (oid === undefined && !unbornCurrent) fail(`fatal: no branch named '${oldName}'`);
  if (!validBranchName(newName)) fail(`fatal: '${newName}' is not a valid branch name`);
  if (oldName !== newName && has(ctx.state.branches, newName) && !force) {
    fail(`fatal: a branch named '${newName}' already exists`);
  }
  if (oid !== undefined) {
    const message = `Branch: renamed refs/heads/${oldName} to refs/heads/${newName}`;
    const log = own(ctx.state.branchReflogs, oldName) ?? [];
    delete ctx.state.branches[oldName];
    delete ctx.state.branchReflogs[oldName];
    setOwn(ctx.state.branches, newName, oid);
    setOwn(ctx.state.branchReflogs, newName, [...log, { oid, previous: oid, message, time: ctx.time }]);
    const up = own(ctx.state.upstreams, oldName);
    delete ctx.state.upstreams[oldName];
    if (up) setOwn(ctx.state.upstreams, newName, up);
    ctx.emit({ type: "branch-deleted", actor: ctx.actor, name: oldName, oid });
    ctx.emit({ type: "branch-created", actor: ctx.actor, name: newName, oid });
    // Git logs the delete and the re-create of the checked-out branch to that worktree's HEAD log.
    if (wt.head.kind === "branch" && wt.head.name === oldName) {
      wt.headReflog.push({ oid: ZERO_OID, previous: oid, message, time: ctx.time });
      wt.headReflog.push({ oid, previous: null, message, time: ctx.time });
    }
  }
  for (const other of Object.values(ctx.state.worktrees)) {
    if (other.head.kind !== "branch" || other.head.name !== oldName) continue;
    // Other worktrees that had the branch checked out get one "re-created" line in their HEAD log.
    if (other !== wt && oid !== undefined) {
      other.headReflog.push({
        oid,
        previous: null,
        message: `Branch: renamed refs/heads/${oldName} to refs/heads/${newName}`,
        time: ctx.time,
      });
    }
    ctx.setHead(other, { kind: "branch", name: newName });
  }
}

export function branch(ctx: Ctx, args: string[]): void {
  const p = parseArgs("branch", args, {
    "-d": {},
    "--delete": { alias: "-d" },
    "-D": {},
    "-f": {},
    "--force": { alias: "-f" },
    "-m": {},
    "--move": { alias: "-m" },
    "-M": {},
    "-a": {},
    "--all": { alias: "-a" },
    "-r": {},
    "--remotes": { alias: "-r" },
    "-v": {},
    "--verbose": { alias: "-v" },
    "-u": { value: true },
    "--set-upstream-to": { value: true, alias: "-u" },
    "--unset-upstream": {},
    "--list": {},
    "--show-current": {},
  });
  const wt = ctx.wt;
  const names = p.positional;

  if (flag(p, "--show-current")) {
    if (wt.head.kind === "branch") ctx.out(wt.head.name);
    return;
  }
  if (flag(p, "-d") || flag(p, "-D")) {
    deleteBranches(ctx, names, flag(p, "-D") || (flag(p, "-d") && flag(p, "-f")));
    return;
  }
  if (flag(p, "-m") || flag(p, "-M")) {
    rename(ctx, names, flag(p, "-M") || flag(p, "-f"));
    return;
  }
  const upstream = value(p, "-u");
  if (upstream !== undefined) {
    const target = names[0] ?? (wt.head.kind === "branch" ? wt.head.name : null);
    if (!target) fail("fatal: could not set upstream of HEAD when it does not point to any branch");
    if (!has(ctx.state.branches, target)) fail(`fatal: branch '${target}' does not exist`);
    const key = remoteTrackingKey(ctx.state, upstream);
    if (!key) fail(`fatal: the requested upstream branch '${upstream}' does not exist`);
    setUpstream(ctx, target, key);
    return;
  }
  if (flag(p, "--unset-upstream")) {
    const target = names[0] ?? (wt.head.kind === "branch" ? wt.head.name : null);
    if (!target || !has(ctx.state.upstreams, target)) fail(`fatal: branch '${target ?? "HEAD"}' has no upstream information`);
    delete ctx.state.upstreams[target];
    return;
  }
  if (names.length === 0 || flag(p, "--list")) {
    list(ctx, { all: flag(p, "-a"), remotes: flag(p, "-r"), verbose: flag(p, "-v") });
    return;
  }
  if (names.length > 2) fail("fatal: too many arguments for a create operation");
  const [name, start] = names;
  const force = flag(p, "-f");
  checkNewBranchName(ctx, name, force);
  if (force) {
    const user = ctx.worktreeUsing(name);
    if (user) fail(`fatal: cannot force update the branch '${name}' used by worktree at '${user.path}'`);
  }
  let oid: Oid;
  if (start === undefined) {
    const head = ctx.headOid();
    if (!head) fail(`fatal: not a valid object name: '${wt.head.kind === "branch" ? wt.head.name : "HEAD"}'`);
    oid = head;
  } else {
    oid = resolveOrFail(ctx, start);
  }
  createBranch(ctx, name, oid, start ?? "HEAD");
  trackIfRemote(ctx, name, start);
}
