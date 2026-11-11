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
/** A drawn label that names must not cover, in map units. */
export type Box = { lo: number; hi: number; top: number; bottom: number };

/** Name pills stack upwards beside the robots' heads: the lowest one sits this far above the stop. */
export const NAME_BASE = 30;
export const NAME_STEP = 20;
const NAME_HALF = 9;

/** Names stacked above a group start this far above the stop: clear of the robots' heads. */
export const NAME_ABOVE = 80;
/** How tall a robot stands above its stop, for keeping names off robots on the row above. */
const ROBOT_REACH = 66;

export type NamePlace = { side: "left" | "right" | "above"; x: number };

/**
 * Where a robot group's name pills go: to the right, unless something is in the way there and the
 * left is clear. In the way: another group on about the same height, or a label (`boxes`, such as
 * the tags under a stop on the row above) that the stack of `count` names would cover.
 * When both sides are blocked the names go above the robots, if nothing is there and they stay
 * below `minY` (the top of the map). Failing that, the side with less in the way wins, and a tie
 * stays right.
 */
export function nameSide(
  group: { x: number; y: number; left: number; right: number; reach: number; count?: number },
  others: Span[],
  boxes: Box[] = [],
  minY = -Infinity,
): NamePlace {
  const stack = ((group.count ?? 1) - 1) * NAME_STEP;
  const overlap = (lo: number, hi: number, from: number, to: number) => Math.max(0, Math.min(hi, to) - Math.max(lo, from));
  const covered = (from: number, to: number, top: number, bottom: number) =>
    boxes.reduce((sum, b) => sum + (b.bottom > top && b.top < bottom ? overlap(b.lo, b.hi, from, to) : 0), 0);
  const beside = (from: number, to: number) =>
    others.reduce((sum, o) => sum + (Math.abs(o.y - group.y) <= 40 ? overlap(o.lo, o.hi, from, to) : 0), 0) +
    covered(from, to, group.y - NAME_BASE - stack - NAME_HALF, group.y - NAME_BASE + NAME_HALF);
  const rightEdge = group.x + group.right + 6;
  const leftEdge = group.x + group.left - 6;
  const right: NamePlace = { side: "right", x: rightEdge };
  const left: NamePlace = { side: "left", x: leftEdge };
  const onRight = beside(rightEdge, rightEdge + group.reach);
  if (onRight === 0) return right;
  const onLeft = beside(leftEdge - group.reach, leftEdge);
  if (onLeft === 0) return left;

  const centre = group.x + (group.left + group.right) / 2;
  const half = (group.reach - 8) / 2;
  const top = group.y - NAME_ABOVE - stack - NAME_HALF;
  const bottom = group.y - NAME_ABOVE + NAME_HALF;
  const robotsThere = others.some((o) => o.y - ROBOT_REACH < bottom && o.y + NAME_HALF > top && o.hi > centre - half && o.lo < centre + half);
  if (top >= minY && !robotsThere && covered(centre - half, centre + half, top, bottom) === 0) return { side: "above", x: centre };
  return onLeft < onRight ? left : right;
}

/** A hover card under a stop, kept inside the map. */
export function cardBox(stopX: number, stopY: number, message: string, mapWidth: number, stopR: number) {
  const text = message.length > 44 ? `${message.slice(0, 43)}…` : message;
  const w = Math.max(text.length * 6.7, 120) + 24;
  const x = Math.min(Math.max(stopX - w / 2, 8), mapWidth - w - 8);
  return { text, x, y: stopY + stopR + 22, w, h: 44 };
}
