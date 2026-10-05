// git log, git reflog

import { flag, parseArgs, value } from "../args";
import { fail, type Ctx } from "../context";
import { shortOid, subject } from "../objects";
import { resolveRev, walk } from "../revisions";
import type { Oid, ReflogEntry } from "../types";

/** "(HEAD -> main, origin/main, feature)" style labels for each commit. */
function decorations(ctx: Ctx): Map<Oid, string[]> {
  const map = new Map<Oid, string[]>();
  const add = (oid: Oid, label: string) => {
    const list = map.get(oid) ?? [];
    list.push(label);
    map.set(oid, list);
  };
  const wt = ctx.wt;
  const headBranch = wt.head.kind === "branch" ? wt.head.name : null;
  if (wt.head.kind === "detached") add(wt.head.oid, "HEAD");
  for (const [name, oid] of Object.entries(ctx.state.branches).sort()) {
    add(oid, name === headBranch ? `HEAD -> ${name}` : name);
  }
  for (const [name, oid] of Object.entries(ctx.state.remoteTracking).sort()) add(oid, name);
  for (const list of map.values()) {
    const i = list.findIndex((l) => l.startsWith("HEAD"));
    if (i > 0) list.unshift(...list.splice(i, 1));
  }
  return map;
}

export function log(ctx: Ctx, args: string[]): void {
  const normalized = args.map((a) => (/^-\d+$/.test(a) ? `-n${a.slice(1)}` : a));
  const p = parseArgs("log", normalized, {
    "--oneline": {},
    "--all": {},
    "-n": { value: true },
    "--max-count": { value: true, alias: "-n" },
    "--decorate": {},
  });
  const wt = ctx.wt;
  const starts: Oid[] = [];
  if (flag(p, "--all")) {
    starts.push(...Object.values(ctx.state.branches), ...Object.values(ctx.state.remoteTracking));
    const head = ctx.headOid();
    if (head) starts.push(head);
  }
  for (const rev of p.positional) {
    const oid = resolveRev(ctx.state, ctx.actor, rev);
    if (!oid) {
      fail(
        `fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.`,
        "Use '--' to separate paths from revisions, like this:",
        "'git <command> [<revision>...] -- [<file>...]'",
      );
    }
    starts.push(oid);
  }
  if (starts.length === 0 && !flag(p, "--all")) {
    const head = ctx.headOid();
    if (!head) {
      const name = wt.head.kind === "branch" ? wt.head.name : "HEAD";
      fail(`fatal: your current branch '${name}' does not have any commits yet`);
    }
    starts.push(head);
  }
  const limitText = value(p, "-n");
  const limit = limitText === undefined ? Infinity : Number(limitText);
  if (Number.isNaN(limit)) fail(`fatal: '${limitText}': not an integer`);
  const commits = walk(ctx.state, starts).slice(0, limit);
  const decor = decorations(ctx);
  for (const c of commits) {
    const labels = decor.get(c.oid);
    const d = labels ? ` (${labels.join(", ")})` : "";
    if (flag(p, "--oneline")) {
      ctx.out(`${shortOid(c.oid)}${d} ${subject(c.message)}`);
    } else {
      ctx.out(`commit ${c.oid}${d}`);
      if (c.parents.length > 1) ctx.out(`Merge: ${c.parents.map(shortOid).join(" ")}`);
      ctx.out(`Author: ${c.author}`, "", ...c.message.split("\n").map((l) => `    ${l}`), "");
    }
  }
}

export function reflog(ctx: Ctx, args: string[]): void {
  const rest = args[0] === "show" ? args.slice(1) : args;
  if (rest[0] && ["expire", "delete", "exists"].includes(rest[0])) fail(`git reflog ${rest[0]} is not supported in Merge Crew yet`);
  const p = parseArgs("reflog", rest, { "-n": { value: true } });
  const wt = ctx.wt;
  const ref = p.positional[0] ?? "HEAD";
  let entries: ReflogEntry[];
  let label = ref;
  if (ref === "HEAD" || ref === "@") {
    entries = wt.headReflog;
    label = "HEAD";
  } else {
    const name = ref.startsWith("refs/heads/") ? ref.slice(11) : ref;
    const log = ctx.state.branchReflogs[name];
    if (!log) {
      fail(
        `fatal: ambiguous argument '${ref}': unknown revision or path not in the working tree.`,
        "Use '--' to separate paths from revisions, like this:",
        "'git <command> [<revision>...] -- [<file>...]'",
      );
    }
    entries = log;
    label = name;
  }
  const limitText = value(p, "-n");
  const limit = limitText === undefined ? Infinity : Number(limitText);
  const newestFirst = [...entries].reverse().slice(0, limit);
  newestFirst.forEach((e, i) => ctx.out(`${shortOid(e.oid)} ${label}@{${i}}: ${e.message}`));
}
