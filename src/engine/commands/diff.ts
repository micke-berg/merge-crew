// git diff and git show. Read-only: they print, and never change the state.

import { flag, parseArgs } from "../args";
import { fail, type Ctx } from "../context";
import { get } from "../objects";
import { matches, normalizeSpec } from "../pathspec";
import { mergeBases, resolveRev } from "../revisions";
import type { FileTree, Oid, Path } from "../types";
import { diffStat, patchLines, treeChanges, type FileChange } from "../unified";
import { commitHeader, decorations } from "./log";

function ambiguous(arg: string): never {
  fail(
    `fatal: ambiguous argument '${arg}': unknown revision or path not in the working tree.`,
    "Use '--' to separate paths from revisions, like this:",
    "'git <command> [<revision>...] -- [<file>...]'",
  );
}

function revOrFail(ctx: Ctx, rev: string): Oid {
  const oid = resolveRev(ctx.state, ctx.actor, rev);
  if (!oid) ambiguous(rev);
  return oid;
}

const OUTPUT_FLAGS = {
  "--stat": {},
  "--name-only": {},
  "--name-status": {},
  "-p": {},
  "--patch": { alias: "-p" },
};

type Output = "patch" | "stat" | "name-only" | "name-status";

function outputMode(p: ReturnType<typeof parseArgs>): Output {
  if (flag(p, "--name-only")) return "name-only";
  if (flag(p, "--name-status")) return "name-status";
  if (flag(p, "--stat")) return "stat";
  return "patch";
}

function print(ctx: Ctx, changes: FileChange[], mode: Output): void {
  if (mode === "name-only") ctx.out(...changes.map((c) => c.path));
  else if (mode === "name-status") ctx.out(...changes.map((c) => `${c.old === null ? "A" : c.new === null ? "D" : "M"}\t${c.path}`));
  else if (mode === "stat") ctx.out(...diffStat(changes));
  else ctx.out(...patchLines(changes));
}

/** The working files git compares against: every tracked path, with its working content or absent. */
function trackedWorking(ctx: Ctx, extra: FileTree = {}): FileTree {
  const wt = ctx.wt;
  const out: Record<Path, string> = {};
  const paths = new Set<Path>([...Object.keys(wt.index), ...Object.keys(wt.conflicts), ...Object.keys(extra)]);
  for (const path of paths) {
    if (get(wt.index, path) === undefined && !wt.conflicts[path]) continue;
    const w = get(wt.workingTree, path);
    if (w !== undefined) out[path] = w;
  }
  return out;
}

export function diff(ctx: Ctx, args: string[]): void {
  const p = parseArgs("diff", args, { "--staged": {}, "--cached": { alias: "--staged" }, ...OUTPUT_FLAGS });
  const wt = ctx.wt;
  const revs: string[] = [];
  const specs: string[] = [...(p.afterDashes ?? [])];
  const known = new Set<Path>([...Object.keys(wt.index), ...Object.keys(wt.workingTree), ...Object.keys(wt.conflicts), ...Object.keys(ctx.headTree())]);
  for (const arg of p.positional) {
    // Before "--" every argument is a revision; without it, revisions come first and then paths.
    const isRev = arg.includes("..") || resolveRev(ctx.state, ctx.actor, arg) !== null;
    if (p.afterDashes || (isRev && specs.length === 0)) revs.push(arg);
    else if ([...known].some((path) => matches(arg, path))) specs.push(arg);
    else ambiguous(arg);
  }
  const keep = (path: Path) => specs.length === 0 || specs.some((s) => matches(s, path));
  const staged = flag(p, "--staged");

  let from: FileTree;
  let to: FileTree;
  let againstIndex = false;
  let againstWorking = false;
  if (revs.length > 2) fail("usage: git diff [<options>] [<commit>] [--] [<path>...]");
  if (revs.length === 2) {
    from = ctx.tree(revOrFail(ctx, revs[0]));
    to = ctx.tree(revOrFail(ctx, revs[1]));
  } else if (revs.length === 1 && revs[0].includes("..")) {
    const symmetric = revs[0].includes("...");
    const [a, b] = revs[0].split(symmetric ? "..." : "..");
    const left = revOrFail(ctx, a || "HEAD");
    const right = revOrFail(ctx, b || "HEAD");
    const base = symmetric ? (mergeBases(ctx.state, left, right)[0] ?? null) : left;
    from = ctx.tree(base);
    to = ctx.tree(right);
  } else if (staged) {
    from = revs.length ? ctx.tree(revOrFail(ctx, revs[0])) : ctx.headTree();
    to = wt.index;
    againstIndex = true;
  } else if (revs.length === 1) {
    from = ctx.tree(revOrFail(ctx, revs[0]));
    to = trackedWorking(ctx, from);
    againstWorking = true;
  } else {
    from = wt.index;
    to = trackedWorking(ctx);
    againstWorking = true;
  }

  const unmerged = Object.keys(wt.conflicts).filter(keep).sort();
  const skip = new Set<Path>(againstIndex || againstWorking ? unmerged : []);
  const changes = treeChanges(from, to, (path) => keep(path) && !skip.has(path));
  if (skip.size) ctx.out(...[...skip].map((path) => `* Unmerged path ${path}`));
  print(ctx, changes, outputMode(p));
}

export function show(ctx: Ctx, args: string[]): void {
  const p = parseArgs("show", args, OUTPUT_FLAGS);
  const targets = p.positional.length ? p.positional : ["HEAD"];
  const keep = (path: Path) => !p.afterDashes || p.afterDashes.some((s) => matches(s, path));
  const decor = decorations(ctx);
  targets.forEach((target, i) => {
    const colon = target.indexOf(":");
    if (colon !== -1) {
      // <rev>:<path> prints a file as it is in that commit (":<path>" reads the index).
      const rev = target.slice(0, colon);
      const path = normalizeSpec(target.slice(colon + 1));
      const tree = rev === "" ? ctx.wt.index : ctx.tree(revOrFail(ctx, rev));
      const content = get(tree, path);
      if (content === undefined) {
        if (Object.keys(tree).some((f) => f.startsWith(`${path}/`))) {
          const names = new Set(Object.keys(tree).filter((f) => f.startsWith(`${path}/`)).map((f) => f.slice(path.length + 1).split("/")[0]));
          ctx.out(`tree ${target}`, "", ...[...names].sort().map((n) => (Object.keys(tree).some((f) => f.startsWith(`${path}/${n}/`)) ? `${n}/` : n)));
          return;
        }
        fail(rev === "" ? `fatal: path '${path}' does not exist (neither on disk nor in the index)` : `fatal: path '${path}' does not exist in '${rev}'`);
      }
      ctx.out(content.endsWith("\n") ? content.slice(0, -1) : content);
      return;
    }
    const oid = resolveRev(ctx.state, ctx.actor, target);
    if (!oid) {
      if (!ctx.headOid() && target === "HEAD") fail("fatal: your current branch appears to be broken");
      ambiguous(target);
    }
    const commit = ctx.state.commits[oid];
    if (i > 0) ctx.out("");
    const header = commitHeader(commit, decor);
    if (commit.parents.length > 1) {
      // A merge: git shows a combined diff, which Merge Crew leaves out.
      ctx.out(...header.slice(0, -1));
      return;
    }
    const changes = treeChanges(ctx.tree(commit.parents[0] ?? null), commit.tree, keep);
    if (changes.length === 0) {
      ctx.out(...header.slice(0, -1));
      return;
    }
    ctx.out(...header);
    print(ctx, changes, outputMode(p));
  });
}
