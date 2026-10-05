// Three-way file and tree merges.
//
// mergeFile ports xdl_merge from git's xdiff/xmerge.c at the level git uses for merges
// (XDL_MERGE_ZEALOUS) with the default "merge" conflict style: both sides are diffed against the
// base with diff.ts, overlapping changes become conflict regions, xdl_refine_conflicts shrinks each
// conflict to the lines that really differ, and xdl_simplify_non_conflicts joins conflicts that are
// three lines apart or less.
//
// mergeTrees is a path-by-path merge in the spirit of git's ort strategy (merge-ort.c), without
// rename detection; its messages use ort's wording.
// Checked against git 2.46.0 through the oracle suite (tests/oracle) and the expected outputs of
// `git merge-file` in merge3.test.ts.

import { diffLines, splitLines, type Hunk } from "./diff";
import { get, setOwn } from "./objects";
import type { ConflictEntry, FileTree, Path } from "./types";

/** mode 0 = conflict, 1 = ours changed, 2 = theirs changed, 4 = both made the same change. */
type Region = { mode: number; i0: number; chg0: number; i1: number; chg1: number; i2: number; chg2: number };

function appendRegion(list: Region[], r: Region): void {
  const m = list[list.length - 1];
  if (m && (r.i1 <= m.i1 + m.chg1 || r.i2 <= m.i2 + m.chg2)) {
    if (r.mode !== m.mode) m.mode = 0;
    m.chg0 = r.i0 + r.chg0 - m.i0;
    m.chg1 = r.i1 + r.chg1 - m.i1;
    m.chg2 = r.i2 + r.chg2 - m.i2;
  } else {
    list.push({ ...r });
  }
}

function sameLines(a: string[], ai: number, b: string[], bi: number, n: number): boolean {
  for (let k = 0; k < n; k++) if (a[ai + k] !== b[bi + k]) return false;
  return true;
}

function regions(base: string[], ours: string[], theirs: string[]): Region[] {
  const s1 = diffLines(base, ours);
  const s2 = diffLines(base, theirs);
  const out: Region[] = [];
  let p1 = 0;
  let p2 = 0;
  while (p1 < s1.length && p2 < s2.length) {
    const x1 = s1[p1];
    const x2 = s2[p2];
    if (x1.i1 + x1.chg1 < x2.i1) {
      appendRegion(out, {
        mode: 1,
        i0: x1.i1,
        chg0: x1.chg1,
        i1: x1.i2,
        chg1: x1.chg2,
        i2: x2.i2 - x2.i1 + x1.i1,
        chg2: x1.chg1,
      });
      p1++;
      continue;
    }
    if (x2.i1 + x2.chg1 < x1.i1) {
      appendRegion(out, {
        mode: 2,
        i0: x2.i1,
        chg0: x2.chg1,
        i1: x1.i2 - x1.i1 + x2.i1,
        chg1: x2.chg1,
        i2: x2.i2,
        chg2: x2.chg2,
      });
      p2++;
      continue;
    }
    const identical =
      x1.i1 === x2.i1 && x1.chg1 === x2.chg1 && x1.chg2 === x2.chg2 && sameLines(ours, x1.i2, theirs, x2.i2, x1.chg2);
    if (!identical) {
      const off = x1.i1 - x2.i1;
      const ffo = off + x1.chg1 - x2.chg1;
      let i0 = x1.i1;
      let i1 = x1.i2;
      let i2 = x2.i2;
      if (off > 0) {
        i0 -= off;
        i1 -= off;
      } else {
        i2 += off;
      }
      let chg0 = x1.i1 + x1.chg1 - i0;
      let chg1 = x1.i2 + x1.chg2 - i1;
      let chg2 = x2.i2 + x2.chg2 - i2;
      if (ffo < 0) {
        chg0 -= ffo;
        chg1 -= ffo;
      } else {
        chg2 += ffo;
      }
      appendRegion(out, { mode: 0, i0, chg0, i1, chg1, i2, chg2 });
    }
    const end1 = x1.i1 + x1.chg1;
    const end2 = x2.i1 + x2.chg1;
    if (end1 >= end2) p2++;
    if (end2 >= end1) p1++;
  }
  for (; p1 < s1.length; p1++) {
    const x1 = s1[p1];
    appendRegion(out, {
      mode: 1,
      i0: x1.i1,
      chg0: x1.chg1,
      i1: x1.i2,
      chg1: x1.chg2,
      i2: x1.i1 - base.length + theirs.length,
      chg2: x1.chg1,
    });
  }
  for (; p2 < s2.length; p2++) {
    const x2 = s2[p2];
    appendRegion(out, {
      mode: 2,
      i0: x2.i1,
      chg0: x2.chg1,
      i1: x2.i1 - base.length + ours.length,
      chg1: x2.chg1,
      i2: x2.i2,
      chg2: x2.chg2,
    });
  }
  return out;
}

/** Shrink each conflict to the lines that really differ between the two sides (xdl_refine_conflicts). */
function refine(list: Region[], ours: string[], theirs: string[]): Region[] {
  const out: Region[] = [];
  for (const m of list) {
    if (m.mode !== 0 || m.chg1 === 0 || m.chg2 === 0) {
      out.push(m);
      continue;
    }
    const a = ours.slice(m.i1, m.i1 + m.chg1);
    const b = theirs.slice(m.i2, m.i2 + m.chg2);
    const hunks: Hunk[] = diffLines(a, b);
    if (hunks.length === 0) {
      out.push({ ...m, mode: 4 });
      continue;
    }
    for (const h of hunks) {
      out.push({ mode: 0, i0: m.i0, chg0: m.chg0, i1: m.i1 + h.i1, chg1: h.chg1, i2: m.i2 + h.i2, chg2: h.chg2 });
    }
  }
  return out;
}

/** Conflicts separated by three lines or fewer become one conflict (xdl_simplify_non_conflicts). */
function simplify(list: Region[]): Region[] {
  const out = list.map((r) => ({ ...r }));
  let i = 0;
  while (i + 1 < out.length) {
    const m = out[i];
    const next = out[i + 1];
    const begin = m.i1 + m.chg1;
    const end = next.i1;
    if (m.mode !== 0 || next.mode !== 0 || end - begin > 3) {
      i++;
    } else {
      m.chg1 = next.i1 + next.chg1 - m.i1;
      m.chg2 = next.i2 + next.chg2 - m.i2;
      out.splice(i + 1, 1);
    }
  }
  return out;
}

function withNewline(lines: string[]): string {
  const text = lines.join("");
  return text === "" || text.endsWith("\n") ? text : text + "\n";
}

export type FileMergeResult = { clean: boolean; content: string };

export function mergeFile(
  base: string,
  ours: string,
  theirs: string,
  labels: { ours: string; theirs: string },
): FileMergeResult {
  const b = splitLines(base);
  const o = splitLines(ours);
  const t = splitLines(theirs);
  const list = simplify(refine(regions(b, o, t), o, t));
  let out = "";
  let clean = true;
  let i = 0;
  for (const m of list) {
    if (m.mode === 0) {
      clean = false;
      out += o.slice(i, m.i1).join("");
      out += `<<<<<<< ${labels.ours}\n`;
      out += withNewline(o.slice(m.i1, m.i1 + m.chg1));
      out += "=======\n";
      out += withNewline(t.slice(m.i2, m.i2 + m.chg2));
      out += `>>>>>>> ${labels.theirs}\n`;
    } else if (m.mode === 1 || m.mode === 2) {
      out += o.slice(i, m.i1).join("");
      if (m.mode === 1) out += o.slice(m.i1, m.i1 + m.chg1).join("");
      else out += t.slice(m.i2, m.i2 + m.chg2).join("");
    } else {
      continue;
    }
    i = m.i1 + m.chg1;
  }
  out += o.slice(i).join("");
  return { clean, content: out };
}

export type TreeMergeResult = {
  /** Every path that merged cleanly, with its merged content. */
  merged: Record<Path, string>;
  conflicts: Record<Path, ConflictEntry>;
  /** What the working tree holds for each conflicted path (null = no file). */
  conflictFiles: Record<Path, string | null>;
  messages: string[];
};

/** Path-by-path three-way merge. No rename detection. */
export function mergeTrees(
  base: FileTree,
  ours: FileTree,
  theirs: FileTree,
  labels: { ours: string; theirs: string },
): TreeMergeResult {
  const result: TreeMergeResult = { merged: {}, conflicts: {}, conflictFiles: {}, messages: [] };
  const paths = new Set<Path>([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
  for (const path of [...paths].sort()) {
    const b = get(base, path) ?? null;
    const o = get(ours, path) ?? null;
    const t = get(theirs, path) ?? null;
    let value: string | null;
    if (o === t) value = o;
    else if (b === o) value = t;
    else if (b === t) value = o;
    else if (o !== null && t !== null) {
      result.messages.push(`Auto-merging ${path}`);
      const merged = mergeFile(b ?? "", o, t, labels);
      if (merged.clean) {
        value = merged.content;
      } else {
        result.messages.push(
          b === null
            ? `CONFLICT (add/add): Merge conflict in ${path}`
            : `CONFLICT (content): Merge conflict in ${path}`,
        );
        setOwn(result.conflicts, path, { base: b, ours: o, theirs: t });
        setOwn(result.conflictFiles, path, merged.content);
        continue;
      }
    } else {
      const deletedIn = o === null ? labels.ours : labels.theirs;
      const modifiedIn = o === null ? labels.theirs : labels.ours;
      result.messages.push(
        `CONFLICT (modify/delete): ${path} deleted in ${deletedIn} and modified in ${modifiedIn}.  Version ${modifiedIn} of ${path} left in tree.`,
      );
      setOwn(result.conflicts, path, { base: b, ours: o, theirs: t });
      setOwn(result.conflictFiles, path, o ?? t);
      continue;
    }
    if (value !== null) setOwn(result.merged, path, value);
  }
  return result;
}
