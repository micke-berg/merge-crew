// git blame [<rev>] [--] <file>
//
// Every line of the file is blamed on the commit that introduced it. Starting from the commit, a line
// that is unchanged in a parent is handed to that parent (the first parent that has it, in parent
// order, like git), and a line no parent has is blamed on the commit itself.
//
// Known differences from git: no rename or copy detection, no -L, -w or -C, and no dates (the game
// has none). The output is `<short id> (<author> <line number>) <text>`.

import { parseArgs } from "../args";
import { fail, type Ctx } from "../context";
import { diffLines, splitLines } from "../diff";
import { resolveRev } from "../revisions";
import type { Oid, Path, RepoState } from "../types";

/** For each line of `path` at `oid`, the commit that introduced it. null when the file is not in that commit. */
export function blameLines(state: RepoState, oid: Oid, path: Path): Oid[] | null {
  const tree = state.commits[oid]?.tree;
  if (!tree || tree[path] === undefined) return null;
  const finalCount = splitLines(tree[path]).length;
  const result: Oid[] = new Array<Oid>(finalCount).fill(oid);

  // Work list: a commit and, for each line it still has to explain, its index in this commit's file
  // and its index in the final file.
  const work: { oid: Oid; lines: { here: number; final: number }[] }[] = [
    { oid, lines: Array.from({ length: finalCount }, (_, i) => ({ here: i, final: i })) },
  ];
  while (work.length) {
    const { oid: current, lines } = work.pop()!;
    const commit = state.commits[current];
    let pending = lines;
    const currentLines = splitLines(commit.tree[path] ?? "");
    for (const parentOid of commit.parents) {
      if (pending.length === 0) break;
      const parentText = state.commits[parentOid]?.tree[path];
      if (parentText === undefined) continue;
      const parentLines = splitLines(parentText);
      // Map each line of the current file that also exists in the parent to its place in the parent.
      const same = new Map<number, number>();
      let a = 0;
      let b = 0;
      for (const h of diffLines(parentLines, currentLines)) {
        while (b < h.i2) same.set(b++, a++);
        a += h.chg1;
        b += h.chg2;
      }
      while (b < currentLines.length) same.set(b++, a++);
      const passed: { here: number; final: number }[] = [];
      const kept: { here: number; final: number }[] = [];
      for (const l of pending) {
        const there = same.get(l.here);
        if (there === undefined) kept.push(l);
        else passed.push({ here: there, final: l.final });
      }
      if (passed.length) work.push({ oid: parentOid, lines: passed });
      pending = kept;
    }
    for (const l of pending) result[l.final] = current;
  }
  return result;
}

export function blame(ctx: Ctx, args: string[]): void {
  const p = parseArgs("blame", args, {});
  const positional = [...p.positional, ...(p.afterDashes ?? [])];
  if (positional.length === 0) fail("usage: git blame [<rev>] [--] <file>");
  const path = positional[positional.length - 1];
  const rev = positional.length > 1 ? positional[0] : "HEAD";
  const oid = rev === "HEAD" ? ctx.headOid() : resolveRev(ctx.state, ctx.actor, rev);
  if (!oid) fail(rev === "HEAD" ? "fatal: no such ref: HEAD" : `fatal: no such ref: ${rev}`);
  const owners = blameLines(ctx.state, oid, path);
  if (!owners) fail(`fatal: no such path '${path}' in ${rev}`);
  const text = splitLines(ctx.state.commits[oid].tree[path]);
  const authorWidth = Math.max(...owners.map((o) => ctx.state.commits[o].author.length));
  const numberWidth = String(text.length).length;
  owners.forEach((owner, i) => {
    const c = ctx.state.commits[owner];
    const id = c.parents.length === 0 ? `^${owner.slice(0, 7)}` : owner.slice(0, 8);
    const body = text[i].replace(/\n$/, "");
    ctx.out(`${id} (${c.author.padEnd(authorWidth)} ${String(i + 1).padStart(numberWidth)}) ${body}`);
  });
}
