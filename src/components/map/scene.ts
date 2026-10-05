// What every layer of the history map needs to draw one frame: where things are now, where they
// were, and when they move. Built once per render by HistoryMap.

import type { Transition } from "motion/react";
import type { Oid, RepoState } from "@/engine/types";
import { INK_SOFT, MAIN_COLOR, actorColor, type ActorColor } from "@/lib/palette";
import type { Geometry } from "./geometry";
import type { HeadMarker, Lane, MapLayout, Stop } from "./layout";
import type { GlideKind } from "./motion";
import type { Huddle } from "./placement";
import type { Schedule } from "./timeline";

export const MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace";
export const SANS = "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";
export const LINE_W = 7;
export const STOP_R = 6.5;

export type MapScene = {
  state: RepoState;
  layout: MapLayout;
  /** The layout before this change, or null on the first render. */
  prev: MapLayout | null;
  g: Geometry;
  schedule: Schedule;
  reduce: boolean;
  /** Changes every time a new set of events plays, to restart one-off animations. */
  play: number;
  /** Shadow filter id for the lines. */
  filterId: string;
  lanes: Map<string, Lane>;
  stopsByOid: Map<Oid, Stop>;
  prevStops: Map<Oid, Stop>;
  headsByOid: Map<Oid, HeadMarker[]>;
  slots: Huddle;
  prevSlots: Huddle;
  /** Milliseconds to seconds, or 0 with reduced motion. */
  sec: (ms: number) => number;
  glide: (delayMs: number, kind?: GlideKind) => Transition;
  moveAt: (s: Stop) => number;
  appearAt: (oid: Oid) => number;
  /** True for a stop that was not on the previous layout. */
  isNew: (oid: Oid) => boolean;
};

export function laneColor(lane: Lane | undefined): ActorColor {
  if (!lane || lane.kind === "main") return MAIN_COLOR;
  if (lane.kind === "stash") return { ...MAIN_COLOR, line: INK_SOFT, deep: INK_SOFT };
  return actorColor(lane.owner);
}
