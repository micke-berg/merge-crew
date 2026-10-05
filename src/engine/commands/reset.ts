// git reset

import { flag, parseArgs } from "../args";
import { fail, notSupported, type Ctx } from "../context";
import { get, sortedTree } from "../objects";
import { select } from "../pathspec";
import { queries } from "../query";
import { resolveRev } from "../revisions";
import type { FileTree, Oid, Path } from "../types";

function ambiguous(arg: string): never {
  fail(
    `fatal: ambiguous argument '${arg}': unknown revision or path not in the working tree.`,
    "Use '--' to separate paths from revisions, like this:",
    "'git <command> [<revision>...] -- [<file>...]'",
  );
}

function unstagedSummary(ctx: Ctx): void {
  const st = queries.status(ctx.state, ctx.actor);
  if (st.unstaged.length === 0) return;
  ctx.out("Unstaged changes after reset:", ...st.unstaged.map((e) => `${e.change === "deleted" ? "D" : "M"}\t${e.path}`));
}

function resetPaths(ctx: Ctx, oid: Oid | null, specs: string[]): void {
  const wt = ctx.wt;
  const tree = ctx.tree(oid);
  const { matched } = select(specs, [
    ...Object.keys(wt.index),
    ...Object.keys(wt.conflicts),
    ...Object.keys(tree),
  ]);
  const index = { ...wt.index };
  const conflicts = { ...wt.conflicts };
  for (const path of matched) {
    const content = get(tree, path);
    if (content === undefined) delete index[path];
    else index[path] = content;
    delete conflicts[path];
  }
  wt.index = sortedTree(index);
  wt.conflicts = conflicts;
  unstagedSummary(ctx);
}

/** Replace index and tracked working files with a tree, keeping untracked files (reset --hard). */
export function hardResetFiles(ctx: Ctx, target: FileTree): void {
  const wt = ctx.wt;
  const tracked = new Set<Path>([
    ...Object.keys(wt.index),
    ...Object.keys(wt.conflicts),
    ...Object.keys(ctx.headTree()),
  ]);
  const working: Record<Path, string> = { ...wt.workingTree };
  for (const path of tracked) if (get(target, path) === undefined) delete working[path];
  for (const [path, content] of Object.entries(target)) working[path] = content;
  wt.index = sortedTree({ ...target });
  wt.workingTree = sortedTree(working);
  if (Object.keys(wt.conflicts).length) ctx.conflictsDiscarded = true;
  wt.conflicts = {};
}

export function reset(ctx: Ctx, args: string[]): void {
  const p = parseArgs("reset", args, {
    "--soft": {},
    "--mixed": {},
    "--hard": {},
    "--merge": {},
    "--keep": {},
    "-q": {},
    "--quiet": { alias: "-q" },
  });
  if (flag(p, "--merge") || flag(p, "--keep")) notSupported(`git reset ${flag(p, "--merge") ? "--merge" : "--keep"}`);
  const wt = ctx.wt;
  const mode = flag(p, "--soft") ? "soft" : flag(p, "--hard") ? "hard" : flag(p, "--mixed") ? "mixed" : null;

  let rev: string | null = null;
  let specs: string[] = [];
  if (p.afterDashes) {
    if (p.positional.length > 1) ambiguous(p.positional[1]);
    rev = p.positional[0] ?? null;
    specs = p.afterDashes;
  } else if (p.positional.length) {
    const [first, ...rest] = p.positional;
    if (resolveRev(ctx.state, ctx.actor, first)) {
      rev = first;
      specs = rest;
    } else {
      specs = p.positional;
    }
    const known = [
      ...Object.keys(wt.index),
      ...Object.keys(wt.conflicts),
      ...Object.keys(wt.workingTree),
      ...Object.keys(ctx.headTree()),
    ];
    for (const spec of specs) if (select([spec], known).matched.length === 0) ambiguous(spec);
  }

  let oid: Oid | null;
  if (rev !== null) {
    oid = resolveRev(ctx.state, ctx.actor, rev);
    if (!oid) ambiguous(rev);
  } else {
    oid = ctx.headOid();
  }

  if (specs.length) {
    if (mode === "soft" || mode === "hard") fail(`fatal: Cannot do ${mode} reset with paths.`);
    resetPaths(ctx, oid, specs);
    return;
  }

  const effective = mode ?? "mixed";
  if (effective === "soft" && wt.inProgress?.kind === "merge") fail("fatal: Cannot do a soft reset in the middle of a merge.");

  if (oid === null) {
    // Unborn HEAD and no revision: reset only the index (and files with --hard).
    if (effective === "soft") return;
    if (effective === "hard") hardResetFiles(ctx, {});
    else {
      if (Object.keys(wt.conflicts).length) ctx.conflictsDiscarded = true;
      wt.index = {};
      wt.conflicts = {};
    }
    return;
  }

  const target = ctx.tree(oid);
  if (effective === "hard") {
    hardResetFiles(ctx, target);
  } else if (effective === "mixed") {
    if (Object.keys(wt.conflicts).length) ctx.conflictsDiscarded = true;
    wt.index = sortedTree({ ...target });
    wt.conflicts = {};
  }
  // A reset ends a merge, cherry-pick or revert, but a stopped rebase carries on (git keeps its state).
  if (effective !== "soft" && wt.inProgress && wt.inProgress.kind !== "rebase") {
    ctx.emit({ type: "operation", actor: ctx.actor, kind: wt.inProgress.kind, phase: "aborted" });
    wt.inProgress = null;
  }
  ctx.advanceHead(oid, "reset", `reset: moving to ${rev ?? "HEAD"}`);
  if (effective === "hard") ctx.out(`HEAD is now at ${ctx.oneline(oid)}`);
  else if (effective === "mixed") unstagedSummary(ctx);
}
