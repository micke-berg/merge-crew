// Unified diff output in git's format (`git diff`, `git show`), diffstats, and patch ids for
// rebase's "already upstream" check. Built on the xdiff port in diff.ts.

import { diffLines, splitLines, type Hunk } from "./diff";
import { sha1 } from "./hash";
import { get } from "./objects";
import type { FileTree, Path } from "./types";

const CONTEXT = 3;

function utf8Length(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) n += 1;
    else if (code < 0x800) n += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** The id git gives a file's content (a blob), so `index` lines match real git. */
export function blobId(content: string): string {
  return sha1(`blob ${utf8Length(content)}\0${content}`);
}

const EMPTY_BLOB = "0000000";

/** git's default funcname rule: a line starting with a letter, "_" or "$", trailing space removed, max 80 bytes. */
function funcName(lines: string[], before: number): string {
  for (let i = before; i >= 0; i--) {
    const line = lines[i];
    if (/^[A-Za-z_$]/.test(line)) return line.replace(/\s+$/, "").slice(0, 80);
  }
  return "";
}

function range(start: number, count: number): string {
  // git prints the line before the hunk for an empty range, and leaves out a count of 1.
  const first = count === 0 ? start : start + 1;
  return count === 1 ? `${first}` : `${first},${count}`;
}

function pushLine(out: string[], prefix: string, line: string): void {
  if (line.endsWith("\n")) out.push(prefix + line.slice(0, -1));
  else out.push(prefix + line, "\\ No newline at end of file");
}

/** The hunks of a file diff ("@@" lines and their body), without file headers. */
export function hunkLines(oldText: string, newText: string): string[] {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const changes: Hunk[] = diffLines(a, b);
  const out: string[] = [];
  let i = 0;
  while (i < changes.length) {
    // Group changes whose unchanged gap is small enough to share context (xdl_get_hunk).
    let j = i;
    while (
      j + 1 < changes.length &&
      changes[j + 1].i1 - (changes[j].i1 + changes[j].chg1) <= 2 * CONTEXT
    ) {
      j++;
    }
    const first = changes[i];
    const last = changes[j];
    const s1 = Math.max(0, first.i1 - CONTEXT);
    const s2 = Math.max(0, first.i2 - CONTEXT);
    const e1 = Math.min(a.length, last.i1 + last.chg1 + CONTEXT);
    const e2 = Math.min(b.length, last.i2 + last.chg2 + CONTEXT);
    const func = funcName(a, s1 - 1);
    out.push(`@@ -${range(s1, e1 - s1)} +${range(s2, e2 - s2)} @@${func ? ` ${func}` : ""}`);
    let p1 = s1;
    for (let k = i; k <= j; k++) {
      const c = changes[k];
      for (; p1 < c.i1; p1++) pushLine(out, " ", a[p1]);
      for (let x = 0; x < c.chg1; x++) pushLine(out, "-", a[c.i1 + x]);
      for (let x = 0; x < c.chg2; x++) pushLine(out, "+", b[c.i2 + x]);
      p1 = c.i1 + c.chg1;
    }
    for (; p1 < e1; p1++) pushLine(out, " ", a[p1]);
    i = j + 1;
  }
  return out;
}

/** One file's diff with git's headers. null means the file does not exist on that side. */
export function fileDiff(path: Path, oldText: string | null, newText: string | null): string[] {
  if (oldText === newText) return [];
  const out = [`diff --git a/${path} b/${path}`];
  const oldId = oldText === null ? EMPTY_BLOB : blobId(oldText).slice(0, 7);
  const newId = newText === null ? EMPTY_BLOB : blobId(newText).slice(0, 7);
  if (oldText === null) out.push("new file mode 100644", `index ${oldId}..${newId}`);
  else if (newText === null) out.push("deleted file mode 100644", `index ${oldId}..${newId}`);
  else out.push(`index ${oldId}..${newId} 100644`);
  const body = hunkLines(oldText ?? "", newText ?? "");
  if (body.length === 0) return out;
  out.push(oldText === null ? "--- /dev/null" : `--- a/${path}`, newText === null ? "+++ /dev/null" : `+++ b/${path}`);
  out.push(...body);
  return out;
}

export type FileChange = { path: Path; old: string | null; new: string | null };

/** Paths that differ between two trees, optionally limited to some paths, sorted. */
export function treeChanges(oldTree: FileTree, newTree: FileTree, keep: (path: Path) => boolean = () => true): FileChange[] {
  const paths = new Set<Path>([...Object.keys(oldTree), ...Object.keys(newTree)]);
  const out: FileChange[] = [];
  for (const path of [...paths].sort()) {
    if (!keep(path)) continue;
    const o = get(oldTree, path) ?? null;
    const n = get(newTree, path) ?? null;
    if (o !== n) out.push({ path, old: o, new: n });
  }
  return out;
}

export function patchLines(changes: FileChange[]): string[] {
  return changes.flatMap((c) => fileDiff(c.path, c.old, c.new));
}

function countChanges(c: FileChange): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const h of diffLines(splitLines(c.old ?? ""), splitLines(c.new ?? ""))) {
    added += h.chg2;
    removed += h.chg1;
  }
  return { added, removed };
}

/** `--stat` output: " path | 3 ++-" lines and a summary line. */
export function diffStat(changes: FileChange[]): string[] {
  if (changes.length === 0) return [];
  const counts = changes.map(countChanges);
  const nameWidth = Math.max(...changes.map((c) => c.path.length));
  const totals = counts.map((c) => c.added + c.removed);
  const numberWidth = String(Math.max(...totals)).length;
  // git scales the graph to fit 80 columns.
  const graphWidth = Math.max(10, 80 - nameWidth - numberWidth - 6);
  const max = Math.max(...totals);
  const scale = (n: number) => (max > graphWidth && n > 0 ? Math.max(1, Math.round((n * graphWidth) / max)) : n);
  const out = changes.map((c, i) => {
    const { added, removed } = counts[i];
    const total = totals[i];
    let plus = scale(added);
    let minus = scale(removed);
    if (max > graphWidth && plus + minus > graphWidth) {
      if (plus > minus) plus = graphWidth - minus;
      else minus = graphWidth - plus;
    }
    const graph = "+".repeat(plus) + "-".repeat(minus);
    return ` ${c.path.padEnd(nameWidth)} | ${String(total).padStart(numberWidth)}${graph ? ` ${graph}` : ""}`;
  });
  const added = counts.reduce((n, c) => n + c.added, 0);
  const removed = counts.reduce((n, c) => n + c.removed, 0);
  let summary = ` ${changes.length} file${changes.length === 1 ? "" : "s"} changed`;
  if (added || !removed) summary += `, ${added} insertion${added === 1 ? "" : "s"}(+)`;
  if (removed) summary += `, ${removed} deletion${removed === 1 ? "" : "s"}(-)`;
  if (added === 0 && removed === 0) summary = ` ${changes.length} file${changes.length === 1 ? "" : "s"} changed, 0 insertions(+), 0 deletions(-)`;
  out.push(summary);
  return out;
}

/**
 * A stand-in for `git patch-id`: the diff text without blob ids and line numbers, so the same change
 * made on top of different history gets the same id.
 */
export function patchId(oldTree: FileTree, newTree: FileTree): string {
  const text = patchLines(treeChanges(oldTree, newTree))
    .filter((l) => !l.startsWith("index "))
    .map((l) => (l.startsWith("@@") ? "@@" : l))
    .join("\n");
  return sha1(text);
}
