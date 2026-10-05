// When things on the map move, and how. Pure: the timing comes from the schedule (timeline.ts).

import type { Transition } from "motion/react";
import type { Oid } from "@/engine/types";
import type { Lane, Stop } from "./layout";
import { stopMoveAt, type Schedule } from "./timeline";

/** How long a robot takes to travel along the line, by distance. */
export const travelMs = (distance: number) => Math.round(Math.min(1100, Math.max(450, distance * 4.2)));
/** A hop leaves the ground on its second frame and lands on its fourth. */
export const HOP_LIFT_MS = 160;
export const HOP_FLIGHT_MS = 480;
/** A new stop pops in a little after its line starts drawing. */
export const POP_DELAY_MS = 180;

/**
 * When a stop starts to move. Lost and recovered stops follow their events; a stop that changes
 * row because a branch moved follows that branch. Nothing moves on the first layout.
 */
/** `prevStops` is null on the first layout. */
export function moveAt(schedule: Schedule, prevStops: Map<Oid, Stop> | null, lanes: Map<string, Lane>, s: Stop): number {
  if (!prevStops) return 0;
  const base = stopMoveAt(schedule, s.oid);
  if (base || schedule.lose.has(s.oid) || schedule.recover.has(s.oid)) return base;
  const before = prevStops.get(s.oid);
  if (before && before.row !== s.row) {
    const lane = lanes.get(s.laneId);
    const b = lane?.name ? schedule.branch.get(lane.name) : undefined;
    if (b) return b.at;
  }
  return 0;
}

export type GlideKind = "soft" | "snap" | "drop" | "lift";

/** The spring each kind of movement uses. Reduced motion jumps straight to the end. */
export function glide(delayMs: number, kind: GlideKind = "soft", reduce = false): Transition {
  if (reduce) return { duration: 0 };
  const delay = delayMs / 1000;
  switch (kind) {
    case "snap": return { type: "spring", stiffness: 520, damping: 13, delay };
    case "drop": return { type: "spring", stiffness: 160, damping: 11, mass: 1.1, delay };
    case "lift": return { type: "spring", stiffness: 140, damping: 16, delay };
    default: return { type: "spring", stiffness: 190, damping: 26, delay };
  }
}
