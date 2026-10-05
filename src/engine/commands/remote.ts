// git push, git fetch, git pull

import { flag, parseArgs, value } from "../args";
import { fail, failWith, notSupported, type Ctx } from "../context";
import { shortOid } from "../objects";
import { isAncestor, resolveRev } from "../revisions";
import type { Oid, OutputLine } from "../types";
import { setUpstream } from "./branch";
import { checkNoMergeInProgress, intoSuffix, runMerge } from "./merge";

function requireRemote(ctx: Ctx, name: string): void {
  if (!ctx.state.remotes[name]) {
    fail(
      `fatal: '${name}' does not appear to be a git repository`,
      "fatal: Could not read from remote repository.",
      "",
      "Please make sure you have the correct access rights",
      "and the repository exists.",
    );
  }
}

function defaultRemote(ctx: Ctx): string {
  const wt = ctx.wt;
  if (wt.head.kind === "branch") {
    const up = ctx.state.upstreams[wt.head.name];
    if (up) return up.remote;
  }
  return "origin";
}

function setTracking(ctx: Ctx, key: string, to: Oid | null): void {
  const from = ctx.state.remoteTracking[key] ?? null;
  if (from === to) return;
  if (to === null) delete ctx.state.remoteTracking[key];
  else ctx.state.remoteTracking[key] = to;
  ctx.emit({ type: "remote-tracking-updated", actor: ctx.actor, ref: key, from, to });
}

/**
 * What --force-with-lease expects the remote branch to be: the remote-tracking ref by default, or
 * the commit named in --force-with-lease=<branch>:<expect>. "<branch>:" with nothing after it
 * means the branch must not exist yet.
 */
function leaseExpectation(ctx: Ctx, lease: string, remote: string, dst: string): Oid | null | undefined {
  if (lease === "") return ctx.state.remoteTracking[`${remote}/${dst}`] ?? null;
  const colon = lease.indexOf(":");
  const ref = (colon === -1 ? lease : lease.slice(0, colon)).replace(/^refs\/heads\//, "");
  if (ref !== dst) return undefined;
  if (colon === -1) return ctx.state.remoteTracking[`${remote}/${dst}`] ?? null;
  const expect = lease.slice(colon + 1);
  if (expect === "") return null;
  const oid = resolveRev(ctx.state, ctx.actor, expect);
  if (!oid) fail(`error: cannot parse expected object name '${expect}'`);
  return oid;
}

type PushUpdate = { src: string | null; srcBranch: string | null; oid: Oid | null; dst: string; force: boolean };

export function push(ctx: Ctx, args: string[]): void {
  const p = parseArgs("push", args, {
    "-u": {},
    "--set-upstream": { alias: "-u" },
    "-f": {},
    "--force": { alias: "-f" },
    "--force-with-lease": { optional: true },
    "-d": {},
    "--delete": { alias: "-d" },
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  const wt = ctx.wt;
  const [remoteArg, ...specs] = p.positional;
  const remote = remoteArg ?? defaultRemote(ctx);
  requireRemote(ctx, remote);
  const current = wt.head.kind === "branch" ? wt.head.name : null;
  const updates: PushUpdate[] = [];

  if (flag(p, "-d")) {
    if (specs.length === 0) fail("fatal: --delete doesn't make sense without any refs");
    for (const s of specs) updates.push({ src: null, srcBranch: null, oid: null, dst: s.replace(/^refs\/heads\//, ""), force: false });
  } else if (specs.length === 0) {
    if (!current) {
      fail(
        "fatal: You are not currently on a branch.",
        "To push the history leading to the current (detached HEAD)",
        "state now, use",
        "",
        "    git push origin HEAD:<name-of-remote-branch>",
      );
    }
    const up = ctx.state.upstreams[current];
    let dst = current;
    if (!up) {
      fail(
        `fatal: The current branch ${current} has no upstream branch.`,
        "To push the current branch and set the remote as upstream, use",
        "",
        `    git push --set-upstream ${remote} ${current}`,
      );
    }
    if (up.remote === remote) {
      if (up.branch !== current) {
        fail(
          "fatal: The upstream branch of your current branch does not match",
          "the name of your current branch.  To push to the upstream branch",
          "on the remote, use",
          "",
          `    git push ${remote} HEAD:${up.branch}`,
        );
      }
      dst = up.branch;
    }
    const oid = ctx.state.branches[current];
    if (!oid) fail(`error: src refspec ${current} does not match any`, `error: failed to push some refs to '${remote}'`);
    updates.push({ src: current, srcBranch: current, oid, dst, force: false });
  } else {
    for (const raw of specs) {
      let spec = raw;
      let force = false;
      if (spec.startsWith("+")) {
        force = true;
        spec = spec.slice(1);
      }
      const colon = spec.indexOf(":");
      const src = colon === -1 ? spec : spec.slice(0, colon);
      let dst = colon === -1 ? null : spec.slice(colon + 1);
      if (src === "") {
        if (!dst) fail(`error: invalid refspec '${raw}'`);
        updates.push({ src: null, srcBranch: null, oid: null, dst: dst.replace(/^refs\/heads\//, ""), force });
        continue;
      }
      const srcName = src.replace(/^refs\/heads\//, "");
      let srcBranch: string | null = null;
      if (ctx.state.branches[srcName] !== undefined) srcBranch = srcName;
      else if (src === "HEAD" && current) srcBranch = current;
      const oid = resolveRev(ctx.state, ctx.actor, src);
      if (!oid) fail(`error: src refspec ${src} does not match any`, `error: failed to push some refs to '${remote}'`);
      if (dst === null) {
        if (!srcBranch) {
          fail(
            "error: The destination you provided is not a full refname (i.e.,",
            'starting with "refs/"). Try pushing to a named branch, like',
            `    git push ${remote} ${src}:<branch>`,
          );
        }
        dst = srcBranch;
      }
      updates.push({ src, srcBranch, oid, dst: dst.replace(/^refs\/heads\//, ""), force });
    }
  }

  const remoteState = ctx.state.remotes[remote];
  const lines: OutputLine[] = [{ kind: "out", text: `To ${remote}` }];
  let rejected: "non-fast-forward" | "stale" | null = null;
  const accepted: { u: PushUpdate; old: Oid | null; forced: boolean }[] = [];
  for (const u of updates) {
    const old = remoteState.branches[u.dst] ?? null;
    const label = `${u.src ?? "(delete)"} -> ${u.dst}`;
    if (u.oid === null) {
      if (old === null) {
        lines.push({ kind: "error", text: `error: unable to delete '${u.dst}': remote ref does not exist` });
        rejected = rejected ?? "non-fast-forward";
        continue;
      }
      lines.push({ kind: "out", text: ` - [deleted]         ${u.dst}` });
      accepted.push({ u, old, forced: false });
      continue;
    }
    if (old === u.oid) {
      accepted.push({ u, old, forced: false });
      continue;
    }
    const fastForward = old === null || isAncestor(ctx.state, old, u.oid);
    if (flag(p, "--force-with-lease")) {
      const expected = leaseExpectation(ctx, value(p, "--force-with-lease") ?? "", remote, u.dst);
      if (expected === undefined) {
        if (!fastForward && !u.force && !flag(p, "-f")) {
          lines.push({ kind: "error", text: ` ! [rejected]        ${label} (non-fast-forward)` });
          rejected = rejected ?? "non-fast-forward";
          continue;
        }
      } else if (expected !== old) {
        lines.push({ kind: "error", text: ` ! [rejected]        ${label} (stale info)` });
        rejected = "stale";
        continue;
      }
    } else if (!fastForward && !u.force && !flag(p, "-f")) {
      lines.push({ kind: "error", text: ` ! [rejected]        ${label} (non-fast-forward)` });
      rejected = rejected ?? "non-fast-forward";
      continue;
    }
    if (old === null) lines.push({ kind: "out", text: ` * [new branch]      ${label}` });
    else if (fastForward) lines.push({ kind: "out", text: `   ${shortOid(old)}..${shortOid(u.oid)}  ${label}` });
    else lines.push({ kind: "out", text: ` + ${shortOid(old)}...${shortOid(u.oid)} ${label} (forced update)` });
    accepted.push({ u, old, forced: !fastForward });
  }

  if (rejected) {
    lines.push({ kind: "error", text: `error: failed to push some refs to '${remote}'` });
    if (rejected === "non-fast-forward") {
      lines.push(
        { kind: "hint", text: "hint: Updates were rejected because the tip of your current branch is behind" },
        { kind: "hint", text: "hint: its remote counterpart. If you want to integrate the remote changes," },
        { kind: "hint", text: "hint: use 'git pull' before pushing again." },
      );
    }
    failWith(lines);
  }

  const changed = accepted.some((a) => a.old !== a.u.oid);
  if (!changed) lines.splice(0, lines.length, { kind: "out", text: "Everything up-to-date" });
  ctx.output.push(...lines);
  for (const { u, old, forced } of accepted) {
    if (old !== u.oid) {
      if (u.oid === null) delete remoteState.branches[u.dst];
      else remoteState.branches[u.dst] = u.oid;
      ctx.emit({ type: "remote-updated", actor: ctx.actor, remote, branch: u.dst, from: old, to: u.oid, forced });
    }
    setTracking(ctx, `${remote}/${u.dst}`, u.oid);
    if (flag(p, "-u") && u.srcBranch) setUpstream(ctx, u.srcBranch, `${remote}/${u.dst}`);
  }
}

/** Copy the remote's branches into remote-tracking refs. `only` limits it to one branch. */
function fetchRemote(ctx: Ctx, remote: string, opts: { only?: string; prune?: boolean }): void {
  const remoteState = ctx.state.remotes[remote];
  const lines: string[] = [];
  const names = opts.only !== undefined ? [opts.only] : Object.keys(remoteState.branches).sort();
  for (const name of names) {
    const to = remoteState.branches[name];
    if (to === undefined) fail(`fatal: couldn't find remote ref ${name}`);
    const key = `${remote}/${name}`;
    const from = ctx.state.remoteTracking[key] ?? null;
    if (from === to) continue;
    if (from === null) lines.push(` * [new branch]      ${name} -> ${key}`);
    else if (isAncestor(ctx.state, from, to)) lines.push(`   ${shortOid(from)}..${shortOid(to)}  ${name} -> ${key}`);
    else lines.push(` + ${shortOid(from)}...${shortOid(to)} ${name} -> ${key}  (forced update)`);
    setTracking(ctx, key, to);
  }
  if (opts.prune) {
    for (const key of Object.keys(ctx.state.remoteTracking).sort()) {
      if (!key.startsWith(`${remote}/`)) continue;
      if (remoteState.branches[key.slice(remote.length + 1)] === undefined) {
        lines.push(` - [deleted]         (none) -> ${key}`);
        setTracking(ctx, key, null);
      }
    }
  }
  if (lines.length) ctx.out(`From ${remote}`, ...lines);
}

export function fetch(ctx: Ctx, args: string[]): void {
  const p = parseArgs("fetch", args, {
    "--all": {},
    "-p": {},
    "--prune": { alias: "-p" },
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  const prune = flag(p, "-p");
  if (flag(p, "--all")) {
    for (const remote of Object.keys(ctx.state.remotes).sort()) fetchRemote(ctx, remote, { prune });
    return;
  }
  const [remoteArg, ...branches] = p.positional;
  const remote = remoteArg ?? defaultRemote(ctx);
  requireRemote(ctx, remote);
  if (branches.length > 1) notSupported("Fetching several branches at once");
  fetchRemote(ctx, remote, { only: branches[0]?.replace(/^refs\/heads\//, ""), prune });
}

export function pull(ctx: Ctx, args: string[]): void {
  const p = parseArgs("pull", args, {
    "--ff-only": {},
    "--no-ff": {},
    "--ff": {},
    "--no-rebase": {},
    "--rebase": {},
    "-r": { alias: "--rebase" },
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  if (flag(p, "--rebase")) notSupported("git pull --rebase");
  const wt = ctx.wt;
  checkNoMergeInProgress(ctx, "Pulling");
  const current = wt.head.kind === "branch" ? wt.head.name : null;
  const [remoteArg, branchArg, ...extra] = p.positional;
  if (extra.length) notSupported("Pulling several branches at once");
  if (!current && !branchArg) {
    fail(
      "You are not currently on a branch.",
      "Please specify which branch you want to merge with.",
      "",
      "    git pull <remote> <branch>",
    );
  }
  const up = current ? ctx.state.upstreams[current] : undefined;
  let remote: string;
  let branch: string;
  if (branchArg) {
    remote = remoteArg;
    branch = branchArg.replace(/^refs\/heads\//, "");
  } else if (remoteArg) {
    remote = remoteArg;
    if (!up || up.remote !== remote) {
      requireRemote(ctx, remote);
      fail(
        `You asked to pull from the remote '${remote}', but did not specify`,
        "a branch. Because this is not the default configured remote",
        "for your current branch, you must specify a branch on the command line.",
      );
    }
    branch = up.branch;
  } else {
    if (!up) {
      fail(
        "There is no tracking information for the current branch.",
        "Please specify which branch you want to merge with.",
        "",
        "    git pull <remote> <branch>",
        "",
        "If you wish to set tracking information for this branch you can do so with:",
        "",
        `    git branch --set-upstream-to=origin/<branch> ${current}`,
      );
    }
    remote = up.remote;
    branch = up.branch;
  }
  requireRemote(ctx, remote);
  fetchRemote(ctx, remote, { only: branchArg ? branch : undefined });
  const theirs = ctx.state.remotes[remote].branches[branch];
  if (theirs === undefined) fail(`fatal: couldn't find remote ref ${branch}`);
  runMerge(ctx, {
    theirs,
    label: theirs,
    message: `Merge branch '${branch}' of ${remote}${intoSuffix(ctx)}`,
    reflogPrefix: ["pull", ...args].join(" "),
    ff: flag(p, "--ff-only") ? "only" : flag(p, "--no-ff") ? "never" : "allow",
  });
}
