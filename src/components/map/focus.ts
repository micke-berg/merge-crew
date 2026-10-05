// Which parts of the map a guided-tour line singles out. Pure, so the matching rules can be tested.

import type { Oid } from "@/engine/types";
import type { Lane, MapLayout } from "./layout";

/** What a tour line asks the map to highlight: commits by message, branch lines by name, the lost band. */
export type MapFocus = { commits?: string[]; branches?: string[]; lost?: boolean };

export type ResolvedFocus = {
  /** Stops to ring, matched by commit message. */
  stops: Oid[];
  /** Lines to glow, matched by branch name. */
  lanes: Lane[];
  /** Outline the lost band. Only when there is one. */
  lost: boolean;
};

/**
 * Match a focus against the drawn map. Commits match on their exact message. Branch names match a
 * line's name; when a level names a branch the player was free to call something else (none of the
 * named branches exist), every local branch line except main is highlighted instead, so the line
 * still lights up whatever the player called it.
 */
export function resolveFocus(layout: MapLayout, focus: MapFocus | null | undefined): ResolvedFocus {
  if (!focus) return { stops: [], lanes: [], lost: false };
  const messages = new Set(focus.commits ?? []);
  const stops = layout.stops.filter((s) => messages.has(s.message)).map((s) => s.oid);
  const names = new Set(focus.branches ?? []);
  let lanes = layout.lanes.filter((l) => l.name !== null && names.has(l.name));
  if (names.size > 0 && lanes.length === 0) lanes = layout.lanes.filter((l) => l.kind === "branch");
  return { stops, lanes, lost: !!focus.lost && layout.ghostRow !== null };
}

export function isEmptyFocus(f: ResolvedFocus): boolean {
  return f.stops.length === 0 && f.lanes.length === 0 && !f.lost;
}
