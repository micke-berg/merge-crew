// Conflict markers in a working file: parse them into regions, resolve regions one by one, and
// describe the situation in plain words. Pure functions, no React, so the editor and tests share them.

import type { InProgress, Worktree } from "@/engine/types";

/** A conflict region: what each side wrote between the markers. Text keeps its line endings. */
export type ConflictRegion = {
  kind: "conflict";
  /** Position among the file's regions, starting at 0. */
  index: number;
  /** The label after <<<<<<<, e.g. "HEAD" or "Updated upstream". Empty when git wrote none. */
  oursLabel: string;
  /** The label after >>>>>>>, e.g. "feature" or "Stashed changes". */
  theirsLabel: string;
  ours: string;
  theirs: string;
  /** The common ancestor, only present in diff3 style (a ||||||| section). */
  base: string | null;
  /** The region exactly as it appears in the file, markers included. */
  raw: string;
};

export type Segment = { kind: "text"; text: string } | ConflictRegion;

export type Choice = "ours" | "theirs" | "both";

const OPEN = /^<{7}(?: (.*))?$/;
const BASE = /^\|{7}(?: .*)?$/;
const SPLIT = /^={7}$/;
const CLOSE = /^>{7}(?: (.*))?$/;

/** Split into lines that keep their "\n", so joining them gives the original text back. */
function lines(text: string): string[] {
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

function bare(line: string): string {
  return line.replace(/\r?\n$/, "");
}

/**
 * Split a file into plain text and conflict regions. A region needs all three markers in order
 * (<<<<<<<, =======, >>>>>>>), with an optional ||||||| base section. Anything that does not form a
 * complete region, such as a stray ======= line, stays plain text.
 */
export function parseConflicts(content: string): Segment[] {
  const all = lines(content);
  const segments: Segment[] = [];
  let text = "";
  let index = 0;
  let i = 0;
  while (i < all.length) {
    const open = OPEN.exec(bare(all[i]));
    const region = open ? readRegion(all, i, open[1] ?? "") : null;
    if (!region) {
      text += all[i];
      i++;
      continue;
    }
    if (text) segments.push({ kind: "text", text });
    text = "";
    segments.push({ ...region.region, index: index++ });
    i = region.next;
  }
  if (text) segments.push({ kind: "text", text });
  return segments;
}

function readRegion(
  all: string[],
  start: number,
  oursLabel: string,
): { region: Omit<ConflictRegion, "index">; next: number } | null {
  let ours = "";
  let base: string | null = null;
  let theirs = "";
  let section: "ours" | "base" | "theirs" = "ours";
  for (let i = start + 1; i < all.length; i++) {
    const line = bare(all[i]);
    // A new opening marker before this region closed: the first one was not a real region.
    if (OPEN.test(line)) return null;
    if (section === "ours" && BASE.test(line)) {
      section = "base";
      base = "";
      continue;
    }
    if (section !== "theirs" && SPLIT.test(line)) {
      section = "theirs";
      continue;
    }
    if (section === "theirs") {
      const close = CLOSE.exec(line);
      if (close) {
        const raw = all.slice(start, i + 1).join("");
        return {
          region: { kind: "conflict", oursLabel, theirsLabel: close[1] ?? "", ours, theirs, base, raw },
          next: i + 1,
        };
      }
    }
    if (section === "ours") ours += all[i];
    else if (section === "base") base += all[i];
    else theirs += all[i];
  }
  return null;
}

export function conflictRegions(segments: Segment[]): ConflictRegion[] {
  return segments.filter((s): s is ConflictRegion => s.kind === "conflict");
}

/** True when the text still holds at least one complete conflict region. */
export function hasConflictMarkers(content: string): boolean {
  return parseConflicts(content).some((s) => s.kind === "conflict");
}

function withNewline(text: string): string {
  return text === "" || text.endsWith("\n") ? text : `${text}\n`;
}

/** The text one choice puts in place of a region. */
export function resolveRegion(region: ConflictRegion, choice: Choice): string {
  if (choice === "ours") return region.ours;
  if (choice === "theirs") return region.theirs;
  return withNewline(region.ours) + region.theirs;
}

/**
 * Put the file back together. Regions with a choice become that side's text; regions without one
 * keep their markers, so a half-resolved file is still honest about what is left.
 */
export function resolveConflicts(segments: Segment[], choices: Readonly<Record<number, Choice | undefined>>): string {
  return segments
    .map((s) => {
      if (s.kind === "text") return s.text;
      const choice = choices[s.index];
      return choice ? resolveRegion(s, choice) : s.raw;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Plain words
// ---------------------------------------------------------------------------

/** What stopped: the operation in progress, or a stash apply when nothing is in progress. */
export type ConflictSource = InProgress["kind"] | "stash";

export function conflictSource(wt: Pick<Worktree, "inProgress">): ConflictSource {
  return wt.inProgress?.kind ?? "stash";
}

const VERB: Record<ConflictSource, string> = {
  merge: "Merging",
  rebase: "Rebasing",
  "cherry-pick": "Cherry-picking",
  revert: "Reverting",
  stash: "Applying the stash",
};

const FINISH: Record<ConflictSource, string> = {
  merge: "git commit",
  rebase: "git rebase --continue",
  "cherry-pick": "git cherry-pick --continue",
  revert: "git revert --continue",
  stash: "",
};

const ABORT: Record<ConflictSource, string> = {
  merge: "git merge --abort",
  rebase: "git rebase --abort",
  "cherry-pick": "git cherry-pick --abort",
  revert: "git revert --abort",
  stash: "",
};

/** The command that finishes the operation once every file is added, or "" for a stash. */
export function finishCommand(source: ConflictSource): string {
  return FINISH[source];
}

export function abortCommand(source: ConflictSource): string {
  return ABORT[source];
}

/** "Merging stopped: 1 file has changes from both sides." */
export function conflictHeadline(source: ConflictSource, count: number): string {
  const files = count === 1 ? "1 file has" : `${count} files have`;
  return `${VERB[source]} stopped: ${files} changes from both sides.`;
}

/** The line once every conflicted file has been added but the operation is still open. */
export function readyHeadline(source: ConflictSource): string {
  return `Every conflict is fixed. Finish the ${source === "stash" ? "stash" : source} with`;
}

export type SideLabels = { ours: string; theirs: string };

/**
 * Plain names for the two sides of a region. In a rebase HEAD is the branch you are rebasing onto
 * and the incoming side is your own commit, which is the reverse of what most people expect.
 */
export function sideLabels(source: ConflictSource, oursLabel: string, theirsLabel: string): SideLabels {
  const ours = oursLabel || "HEAD";
  const theirs = theirsLabel || "incoming";
  switch (source) {
    case "rebase":
      return { ours: `The new base (${ours})`, theirs: `Your commit being replayed (${theirs})` };
    case "cherry-pick":
      return { ours: `Your side (${ours})`, theirs: `The picked commit (${theirs})` };
    case "revert":
      return { ours: `Your side (${ours})`, theirs: `The undo (${theirs})` };
    case "stash":
      return { ours: `The files now (${ours})`, theirs: `Your stash (${theirs})` };
    case "merge":
      return { ours: `Your side (${ours})`, theirs: `Their side (${theirs})` };
  }
}
