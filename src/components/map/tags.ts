// The small pills that hang below a stop: branch tags, remote tags and the stash. Pure.

import type { ActorId, Oid, RepoState } from "@/engine/types";
import type { BranchLabel, MapLayout } from "./layout";

export type TagKind = "branch" | "remote" | "tracking" | "stash";

export type Tag = {
  key: string;
  oid: Oid;
  text: string;
  kind: TagKind;
  /** Whose colour the tag takes, for branch tags. */
  actor: ActorId | null;
  /** The remote ref, for remote and tracking tags. */
  ref?: string;
};

/** A line-end label only works where the line really ends. A line that merges back gets a tag instead. */
export function labelAtLineEnd(layout: MapLayout, label: BranchLabel): boolean {
  const lane = layout.lanes.find((l) => l.id === label.laneId);
  return label.atLineEnd && lane?.end === label.col;
}

/** Tags per stop, top to bottom: branches, then remote refs, then stashes. */
export function buildTags(layout: MapLayout, state: RepoState): Map<Oid, Tag[]> {
  const byOid = new Map<Oid, Tag[]>();
  const add = (t: Tag) => byOid.set(t.oid, [...(byOid.get(t.oid) ?? []), t]);
  for (const b of layout.branchLabels) {
    if (labelAtLineEnd(layout, b)) continue;
    add({ key: `b:${b.name}`, oid: b.oid, text: b.name, kind: "branch", actor: b.checkedOutBy[0] ?? state.commits[b.oid]?.author ?? null });
  }
  for (const r of layout.remoteTags) {
    const tracking = r.source === "tracking";
    add({ key: `r:${r.ref}:${tracking ? "t" : "s"}`, oid: r.oid, text: r.ref, kind: tracking ? "tracking" : "remote", actor: null, ref: r.ref });
  }
  for (const s of layout.stashes) add({ key: `s:${s.ref}`, oid: s.base, text: s.ref, kind: "stash", actor: "hoarder" });
  return byOid;
}

/** What a tag means, for its tooltip and for screen readers. */
export function tagTitle(t: Tag): string {
  switch (t.kind) {
    case "tracking": return `${t.text}: where this repository last saw the remote branch`;
    case "remote": return `${t.text}: the branch on the server`;
    case "stash": return `${t.text}: stashed work based here`;
    default: return `branch ${t.text}`;
  }
}
