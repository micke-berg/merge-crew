// git add, git rm

import { flag, parseArgs } from "../args";
import { fail, type Ctx } from "../context";
import { get, sortedTree } from "../objects";
import { matchesAsDirectory, normalizeSpec, select } from "../pathspec";
import type { Path } from "../types";

function stagePaths(ctx: Ctx, paths: Path[]): void {
  const wt = ctx.wt;
  const index = { ...wt.index };
  const conflicts = { ...wt.conflicts };
  for (const path of paths) {
    const w = get(wt.workingTree, path);
    if (w === undefined) delete index[path];
    else index[path] = w;
    delete conflicts[path];
  }
  wt.index = sortedTree(index);
  wt.conflicts = conflicts;
}

export function add(ctx: Ctx, args: string[]): void {
  const p = parseArgs("add", args, {
    "-A": {},
    "--all": { alias: "-A" },
    "-u": {},
    "--update": { alias: "-u" },
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  const wt = ctx.wt;
  const specs = [...p.positional, ...(p.afterDashes ?? [])];
  const all = flag(p, "-A");
  const update = flag(p, "-u");
  if (specs.length === 0 && !all && !update) {
    ctx.out("Nothing specified, nothing added.");
    ctx.hint("hint: Maybe you wanted to say 'git add .'?");
    return;
  }
  const tracked = [...Object.keys(wt.index), ...Object.keys(wt.conflicts)];
  const candidates = update ? tracked : [...tracked, ...Object.keys(wt.workingTree)];
  const { matched, unmatched } = select(specs.length ? specs : ["."], candidates);
  const missing = unmatched.filter((spec) => normalizeSpec(spec) !== "");
  if (missing.length) fail(`fatal: pathspec '${missing[0]}' did not match any files`);
  stagePaths(ctx, matched);
}

export function rm(ctx: Ctx, args: string[]): void {
  const p = parseArgs("rm", args, {
    "--cached": {},
    "-f": {},
    "--force": { alias: "-f" },
    "-r": {},
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  const wt = ctx.wt;
  const specs = [...p.positional, ...(p.afterDashes ?? [])];
  if (specs.length === 0) fail("usage: git rm [<options>] [--] <file>...");
  const cached = flag(p, "--cached");
  const force = flag(p, "-f");
  const tracked = [...Object.keys(wt.index), ...Object.keys(wt.conflicts)];
  const paths: Path[] = [];
  for (const spec of specs) {
    const { matched } = select([spec], tracked);
    if (matched.length === 0) fail(`fatal: pathspec '${spec}' did not match any files`);
    if (!flag(p, "-r") && matched.some((m) => matchesAsDirectory(spec, m))) {
      fail(`fatal: not removing '${spec}' recursively without -r`);
    }
    for (const m of matched) if (!paths.includes(m)) paths.push(m);
  }
  paths.sort();

  if (!force) {
    const head = ctx.headTree();
    const both: Path[] = [];
    const staged: Path[] = [];
    const local: Path[] = [];
    for (const path of paths) {
      if (wt.conflicts[path]) continue;
      const w = get(wt.workingTree, path);
      if (w === undefined) continue;
      const i = get(wt.index, path);
      const h = get(head, path);
      const localChanges = w !== i;
      const stagedChanges = h === undefined || h !== i;
      if (localChanges && stagedChanges) both.push(path);
      else if (!cached) {
        if (stagedChanges) staged.push(path);
        else if (localChanges) local.push(path);
      }
    }
    const lines: string[] = [];
    if (both.length) {
      lines.push(
        `error: the following file${both.length > 1 ? "s have" : " has"} staged content different from both the`,
        "file and the HEAD:",
        ...both.map((x) => `    ${x}`),
        "(use -f to force removal)",
      );
    }
    if (staged.length) {
      lines.push(
        `error: the following file${staged.length > 1 ? "s have" : " has"} changes staged in the index:`,
        ...staged.map((x) => `    ${x}`),
        "(use --cached to keep the file, or -f to force removal)",
      );
    }
    if (local.length) {
      lines.push(
        `error: the following file${local.length > 1 ? "s have" : " has"} local modifications:`,
        ...local.map((x) => `    ${x}`),
        "(use --cached to keep the file, or -f to force removal)",
      );
    }
    if (lines.length) fail(...lines);
  }

  const index = { ...wt.index };
  const conflicts = { ...wt.conflicts };
  const working = { ...wt.workingTree };
  for (const path of paths) {
    delete index[path];
    delete conflicts[path];
    if (!cached) delete working[path];
    if (!flag(p, "-q")) ctx.out(`rm '${path}'`);
  }
  wt.index = index;
  wt.conflicts = conflicts;
  wt.workingTree = working;
}

/** Stage every tracked path's working version, like `git add -u`. Used by `commit -a`. */
export function stageTracked(ctx: Ctx): void {
  const wt = ctx.wt;
  stagePaths(ctx, [...new Set([...Object.keys(wt.index), ...Object.keys(wt.conflicts)])]);
}
