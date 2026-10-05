// Line diff ported from git's xdiff (xdiffi.c, xprepare.c): the same preparation, the same Myers
// middle-snake search and the same "change compaction" that slides each changed block down and
// lines it up with changes in the other file. Matching xdiff's choices matters because a merge's
// result depends on which of several equally short diffs is picked.

/** Split into lines that keep their "\n". A last line without a newline is kept as is. */
export function splitLines(text: string): string[] {
  if (text === "") return [];
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

/** One change: `chg1` lines at `i1` in the old file became `chg2` lines at `i2` in the new file. */
export type Hunk = { i1: number; chg1: number; i2: number; chg2: number };

/** Changed-line flags with a guard slot on both ends, like xdiff's rchg arrays. */
class Flags {
  private readonly data: Uint8Array;
  constructor(readonly n: number) {
    this.data = new Uint8Array(n + 2);
  }
  get(i: number): number {
    return this.data[i + 1];
  }
  set(i: number, v: number): void {
    this.data[i + 1] = v;
  }
}

// xdiff's integer square root estimate, used to spot lines that repeat too often to be useful.
function bogosqrt(n: number): number {
  let i = 1;
  for (; n > 0; n >>= 2) i <<= 1;
  return i;
}

/** xdl_clean_mmatch: drop a frequent line only when it sits among lines with no match at all. */
function cleanMmatch(dis: Uint8Array, i: number, s: number, e: number): boolean {
  if (i - s > 100) s = i - 100;
  if (e - i > 100) e = i + 100;
  let rdis0 = 0;
  let rpdis0 = 1;
  for (let r = 1; i - r >= s; r++) {
    if (!dis[i - r]) rdis0++;
    else if (dis[i - r] === 2) rpdis0++;
    else break;
  }
  if (rdis0 === 0) return false;
  let rdis1 = 0;
  let rpdis1 = 1;
  for (let r = 1; i + r <= e; r++) {
    if (!dis[i + r]) rdis1++;
    else if (dis[i + r] === 2) rpdis1++;
    else break;
  }
  if (rdis1 === 0) return false;
  rdis1 += rdis0;
  rpdis1 += rpdis0;
  return rpdis1 * 4 < rpdis1 + rdis1;
}

type Side = { ha: number[]; rindex: number[] };

/**
 * xdiff's preparation: trim the common head and tail, flag lines that have no match in the other
 * file as changed right away, and leave the rest (by class id) for the Myers search.
 */
function prepare(a: string[], b: string[], fa: Flags, fb: Flags): [Side, Side] {
  const ids = new Map<string, number>();
  const id = (line: string) => {
    let v = ids.get(line);
    if (v === undefined) {
      v = ids.size;
      ids.set(line, v);
    }
    return v;
  };
  const ha = a.map(id);
  const hb = b.map(id);
  const countA = new Map<number, number>();
  const countB = new Map<number, number>();
  for (const h of ha) countA.set(h, (countA.get(h) ?? 0) + 1);
  for (const h of hb) countB.set(h, (countB.get(h) ?? 0) + 1);

  let start = 0;
  const lim = Math.min(a.length, b.length);
  while (start < lim && ha[start] === hb[start]) start++;
  let tail = 0;
  while (tail < lim - start && ha[a.length - 1 - tail] === hb[b.length - 1 - tail]) tail++;
  const endA = a.length - tail - 1;
  const endB = b.length - tail - 1;

  const side = (h: number[], other: Map<number, number>, end: number, flags: Flags): Side => {
    const mlim = Math.min(bogosqrt(h.length), 1024);
    const dis = new Uint8Array(h.length + 1);
    for (let i = start; i <= end; i++) {
      const nm = other.get(h[i]) ?? 0;
      dis[i] = nm === 0 ? 0 : nm >= mlim ? 2 : 1;
    }
    const out: Side = { ha: [], rindex: [] };
    for (let i = start; i <= end; i++) {
      if (dis[i] === 1 || (dis[i] === 2 && !cleanMmatch(dis, i, start, end))) {
        out.rindex.push(i);
        out.ha.push(h[i]);
      } else {
        flags.set(i, 1);
      }
    }
    return out;
  };
  return [side(ha, countB, endA, fa), side(hb, countA, endB, fb)];
}

/** xdl_split: find the middle snake of the box, searching forward and backward at once. */
function split(
  ha1: number[],
  off1: number,
  lim1: number,
  ha2: number[],
  off2: number,
  lim2: number,
  kvdf: Int32Array,
  kvdb: Int32Array,
  k0: number,
): [number, number] {
  const dmin = off1 - lim2;
  const dmax = lim1 - off2;
  const fmid = off1 - off2;
  const bmid = lim1 - lim2;
  const odd = ((fmid - bmid) & 1) !== 0;
  let fmin = fmid;
  let fmax = fmid;
  let bmin = bmid;
  let bmax = bmid;
  const LINE_MAX = 0x7fffffff;
  kvdf[k0 + fmid] = off1;
  kvdb[k0 + bmid] = lim1;
  for (;;) {
    if (fmin > dmin) kvdf[k0 + --fmin - 1] = -1;
    else ++fmin;
    if (fmax < dmax) kvdf[k0 + ++fmax + 1] = -1;
    else --fmax;
    for (let d = fmax; d >= fmin; d -= 2) {
      let i1 = kvdf[k0 + d - 1] >= kvdf[k0 + d + 1] ? kvdf[k0 + d - 1] + 1 : kvdf[k0 + d + 1];
      let i2 = i1 - d;
      while (i1 < lim1 && i2 < lim2 && ha1[i1] === ha2[i2]) {
        i1++;
        i2++;
      }
      kvdf[k0 + d] = i1;
      if (odd && bmin <= d && d <= bmax && kvdb[k0 + d] <= i1) return [i1, i2];
    }
    if (bmin > dmin) kvdb[k0 + --bmin - 1] = LINE_MAX;
    else ++bmin;
    if (bmax < dmax) kvdb[k0 + ++bmax + 1] = LINE_MAX;
    else --bmax;
    for (let d = bmax; d >= bmin; d -= 2) {
      let i1 = kvdb[k0 + d - 1] < kvdb[k0 + d + 1] ? kvdb[k0 + d - 1] : kvdb[k0 + d + 1] - 1;
      let i2 = i1 - d;
      while (i1 > off1 && i2 > off2 && ha1[i1 - 1] === ha2[i2 - 1]) {
        i1--;
        i2--;
      }
      kvdb[k0 + d] = i1;
      if (!odd && fmin <= d && d <= fmax && i1 <= kvdf[k0 + d]) return [i1, i2];
    }
  }
}

/** xdl_recs_cmp: divide and conquer around middle snakes, flagging changed lines. */
function compare(
  s1: Side,
  off1: number,
  lim1: number,
  s2: Side,
  off2: number,
  lim2: number,
  f1: Flags,
  f2: Flags,
  kvdf: Int32Array,
  kvdb: Int32Array,
  k0: number,
): void {
  const ha1 = s1.ha;
  const ha2 = s2.ha;
  while (off1 < lim1 && off2 < lim2 && ha1[off1] === ha2[off2]) {
    off1++;
    off2++;
  }
  while (off1 < lim1 && off2 < lim2 && ha1[lim1 - 1] === ha2[lim2 - 1]) {
    lim1--;
    lim2--;
  }
  if (off1 === lim1) {
    for (; off2 < lim2; off2++) f2.set(s2.rindex[off2], 1);
  } else if (off2 === lim2) {
    for (; off1 < lim1; off1++) f1.set(s1.rindex[off1], 1);
  } else {
    const [i1, i2] = split(ha1, off1, lim1, ha2, off2, lim2, kvdf, kvdb, k0);
    compare(s1, off1, i1, s2, off2, i2, f1, f2, kvdf, kvdb, k0);
    compare(s1, i1, lim1, s2, i2, lim2, f1, f2, kvdf, kvdb, k0);
  }
}

function myers(a: string[], b: string[], fa: Flags, fb: Flags): void {
  const [s1, s2] = prepare(a, b, fa, fb);
  const n1 = s1.ha.length;
  const n2 = s2.ha.length;
  const size = n1 + n2 + 5;
  const kvdf = new Int32Array(size);
  const kvdb = new Int32Array(size);
  compare(s1, 0, n1, s2, 0, n2, fa, fb, kvdf, kvdb, n2 + 2);
}

type Group = { start: number; end: number };

function groupInit(f: Flags): Group {
  const g = { start: 0, end: 0 };
  while (f.get(g.end)) g.end++;
  return g;
}

function groupNext(f: Flags, g: Group): boolean {
  if (g.end === f.n) return false;
  g.start = g.end + 1;
  g.end = g.start;
  while (f.get(g.end)) g.end++;
  return true;
}

function groupPrevious(f: Flags, g: Group): boolean {
  if (g.start === 0) return false;
  g.end = g.start - 1;
  g.start = g.end;
  while (f.get(g.start - 1)) g.start--;
  return true;
}

function slideDown(lines: string[], f: Flags, g: Group): boolean {
  if (g.end < f.n && lines[g.start] === lines[g.end]) {
    f.set(g.start++, 0);
    f.set(g.end++, 1);
    while (f.get(g.end)) g.end++;
    return true;
  }
  return false;
}

function slideUp(lines: string[], f: Flags, g: Group): boolean {
  if (g.start > 0 && lines[g.start - 1] === lines[g.end - 1]) {
    f.set(--g.start, 1);
    f.set(--g.end, 0);
    while (f.get(g.start - 1)) g.start--;
    return true;
  }
  return false;
}

/** xdl_change_compact without the indent heuristic, which merges do not use. */
function compact(lines: string[], f: Flags, other: Flags): void {
  const g = groupInit(f);
  const go = groupInit(other);
  for (;;) {
    if (g.end !== g.start) {
      let groupSize: number;
      let earliestEnd: number;
      let endMatchingOther: number;
      do {
        groupSize = g.end - g.start;
        endMatchingOther = -1;
        while (slideUp(lines, f, g)) groupPrevious(other, go);
        earliestEnd = g.end;
        if (go.end > go.start) endMatchingOther = g.end;
        while (slideDown(lines, f, g)) {
          groupNext(other, go);
          if (go.end > go.start) endMatchingOther = g.end;
        }
      } while (groupSize !== g.end - g.start);
      if (g.end !== earliestEnd && endMatchingOther !== -1) {
        while (go.end === go.start) {
          slideUp(lines, f, g);
          groupPrevious(other, go);
        }
      }
    }
    if (!groupNext(f, g)) break;
    groupNext(other, go);
  }
}

function buildScript(fa: Flags, fb: Flags): Hunk[] {
  const hunks: Hunk[] = [];
  let i1 = fa.n;
  let i2 = fb.n;
  while (i1 >= 0 || i2 >= 0) {
    if (fa.get(i1 - 1) || fb.get(i2 - 1)) {
      const l1 = i1;
      const l2 = i2;
      while (fa.get(i1 - 1)) i1--;
      while (fb.get(i2 - 1)) i2--;
      hunks.unshift({ i1, chg1: l1 - i1, i2, chg2: l2 - i2 });
    }
    i1--;
    i2--;
  }
  return hunks;
}

export function diffLines(a: string[], b: string[]): Hunk[] {
  const fa = new Flags(a.length);
  const fb = new Flags(b.length);
  myers(a, b, fa, fb);
  compact(a, fa, fb);
  compact(b, fb, fa);
  return buildScript(fa, fb);
}
