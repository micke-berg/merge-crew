// Where markers and their labels go around a stop, in map units. Pure.

import type { ActorId, Oid } from "@/engine/types";
import type { HeadMarker } from "./layout";

/**
 * Roughly how wide each marker is on the map, used to space markers that share a stop.
 * From the idle artwork at the map's robot height.
 */
export const MARKER_WIDTH: Record<string, number> = { player: 28, tidy: 46, blaze: 54, drift: 48, hoarder: 62 };
export const markerWidth = (actor: ActorId) => MARKER_WIDTH[actor] ?? MARKER_WIDTH.player;

/** Robots standing on one stop spread out sideways, overlapping a little like a huddle. */
export const HUDDLE = 0.88;

export type Huddle = {
  /** Sideways offset of a marker from its stop. */
  dx: (h: HeadMarker) => number;
  /** How far the group on a stop reaches right of the stop (positive) and left of it (negative). */
  right: (oid: Oid) => number;
  left: (oid: Oid) => number;
};

export function huddle(heads: HeadMarker[], width: (actor: ActorId) => number = markerWidth): Huddle {
  const dx = new Map<ActorId, number>();
  const right = new Map<Oid, number>();
  const left = new Map<Oid, number>();
  const groups = new Map<Oid, HeadMarker[]>();
  for (const h of heads) groups.set(h.oid, [...(groups.get(h.oid) ?? []), h]);
  for (const [oid, group] of groups) {
    const hs = [...group].sort((a, b) => a.slot - b.slot);
    const xs: number[] = [0];
    for (let i = 1; i < hs.length; i++) {
      xs.push(xs[i - 1] + ((width(hs[i - 1].actor) + width(hs[i].actor)) / 2) * HUDDLE);
    }
    const mid = (xs[0] + xs[xs.length - 1]) / 2;
    hs.forEach((h, i) => dx.set(h.actor, xs[i] - mid));
    right.set(oid, Math.max(...hs.map((h, i) => xs[i] - mid + width(h.actor) / 2)));
    left.set(oid, Math.min(...hs.map((h, i) => xs[i] - mid - width(h.actor) / 2)));
  }
  return {
    dx: (h) => dx.get(h.actor) ?? 0,
    right: (oid) => right.get(oid) ?? 0,
    left: (oid) => left.get(oid) ?? 0,
  };
}

/** Rough width of a robot's name pill. */
export const nameWidth = (label: string) => label.length * 6.6 + 22;

export type Span = { lo: number; hi: number; y: number };

/**
 * Which side of a robot group its name pills go: to the right, unless another group on about the
 * same height is in the way there and the left is free.
 */
export function nameSide(
  group: { x: number; y: number; left: number; right: number; reach: number },
  others: Span[],
): { side: "left" | "right"; x: number } {
  const blocked = (from: number, to: number) => others.some((o) => Math.abs(o.y - group.y) <= 40 && o.hi > from && o.lo < to);
  const rightEdge = group.x + group.right + 6;
  const leftEdge = group.x + group.left - 6;
  const onLeft = blocked(rightEdge, rightEdge + group.reach) && !blocked(leftEdge - group.reach, leftEdge);
  return onLeft ? { side: "left", x: leftEdge } : { side: "right", x: rightEdge };
}

/** A hover card under a stop, kept inside the map. */
export function cardBox(stopX: number, stopY: number, message: string, mapWidth: number, stopR: number) {
  const text = message.length > 44 ? `${message.slice(0, 43)}…` : message;
  const w = Math.max(text.length * 6.7, 120) + 24;
  const x = Math.min(Math.max(stopX - w / 2, 8), mapWidth - w - 8);
  return { text, x, y: stopY + stopR + 22, w, h: 44 };
}
