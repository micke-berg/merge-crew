// The two shell commands a player needs to look at files: cat and ls. They read the actor's
// working files and never change anything. Paths are relative to the worktree root.

import { fail, notSupported, type Ctx } from "../context";
import { get } from "../objects";
import { normalizeSpec } from "../pathspec";

function isDirectory(ctx: Ctx, path: string): boolean {
  return path === "" || Object.keys(ctx.wt.workingTree).some((f) => f.startsWith(`${path}/`));
}

export function cat(ctx: Ctx, args: string[]): void {
  const files = args.filter((a) => a !== "--");
  for (const a of files) if (a.startsWith("-") && a !== "-") notSupported(`cat ${a}`);
  if (files.length === 0) fail("usage: cat <file>...");
  const errors: string[] = [];
  for (const arg of files) {
    const path = normalizeSpec(arg);
    const content = get(ctx.wt.workingTree, path);
    if (content !== undefined) {
      if (content !== "") ctx.out(content.endsWith("\n") ? content.slice(0, -1) : content);
    } else if (isDirectory(ctx, path)) {
      errors.push(`cat: ${arg}: Is a directory`);
    } else {
      errors.push(`cat: ${arg}: No such file or directory`);
    }
  }
  if (errors.length) fail(...errors);
}

/** Names directly inside a folder, folders marked with a trailing "/" like `ls -F`. */
function entries(ctx: Ctx, dir: string): string[] {
  const prefix = dir === "" ? "" : `${dir}/`;
  const names = new Set<string>();
  for (const file of Object.keys(ctx.wt.workingTree)) {
    if (!file.startsWith(prefix)) continue;
    const rest = file.slice(prefix.length);
    const slash = rest.indexOf("/");
    names.add(slash === -1 ? rest : `${rest.slice(0, slash)}/`);
  }
  return [...names].sort((a, b) => (a.replace(/\/$/, "") < b.replace(/\/$/, "") ? -1 : 1));
}

export function ls(ctx: Ctx, args: string[]): void {
  const paths: string[] = [];
  for (const a of args) {
    if (a === "-1" || a === "-F") continue;
    if (a.startsWith("-") && a !== "-") notSupported(`ls ${a}`);
    paths.push(a);
  }
  if (paths.length === 0) paths.push(".");
  const errors: string[] = [];
  const blocks: string[][] = [];
  const files: string[] = [];
  for (const arg of paths) {
    const path = normalizeSpec(arg);
    if (get(ctx.wt.workingTree, path) !== undefined) files.push(arg);
    else if (isDirectory(ctx, path)) blocks.push([arg, ...entries(ctx, path)]);
    else errors.push(`ls: cannot access '${arg}': No such file or directory`);
  }
  const several = paths.length > 1;
  ctx.out(...files);
  blocks.forEach(([name, ...list], i) => {
    if (several) {
      if (files.length || i > 0) ctx.out("");
      ctx.out(`${name}:`);
    }
    ctx.out(...list);
  });
  if (errors.length) fail(...errors);
}
