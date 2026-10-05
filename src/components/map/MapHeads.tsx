"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ActorId, Mood } from "@/engine/types";
import { INK, TOKENS, WARN, WHITE, actorColor, actorName } from "@/lib/palette";
import { HOP_FLIGHT_MS, HOP_LIFT_MS, POP_DELAY_MS, travelMs } from "./motion";
import { markerWidth, nameSide, nameWidth } from "./placement";
import { RobotMarker, type Facing, type MapAction } from "./RobotMarker";
import { STOP_R, type MapScene } from "./scene";

/** Every crew member standing on the commit its worktree has checked out. */
export function MapRobots({ scene, moods }: { scene: MapScene; moods?: Partial<Record<ActorId, Mood>> }) {
  const { state, layout, g, prev, schedule, reduce, play, stopsByOid, slots, prevSlots, sec, glide, moveAt, isNew } = scene;
  const prevHeads = new Map((prev?.heads ?? []).map((h) => [h.actor, h]));
  return layout.heads.map((h) => {
    const before = prevHeads.get(h.actor);
    const moved = !!before && before.oid !== h.oid;
    const appeared = !!prev && !before;
    const x = g.x(h.col) + slots.dx(h);
    // The ground anchor rests on top of the stop.
    const y = g.y(h.row) - STOP_R - 1;
    const prevX = before ? g.x(before.col) + prevSlots.dx(before) : x;
    const facing: Facing = moved && x < prevX - 1 ? "left" : "right";
    const target = stopsByOid.get(h.oid)!;
    const delay = (schedule.actorMove.get(h.actor) ?? moveAt(target)) + (isNew(h.oid) ? POP_DELAY_MS : 0);
    const mood: Mood = moods?.[h.actor] ?? (h.conflicted ? "scared" : "idle");
    const conflictAt = schedule.conflict.get(h.actor) ?? 0;
    // Hopping onto a commit you just made; travelling along the line for everything else
    // (reset, checkout, pull, a branch moved under you).
    const hop = moved && isNew(h.oid) && state.commits[h.oid]?.author === h.actor;
    const travel = hop ? HOP_FLIGHT_MS : travelMs(Math.hypot(x - prevX, g.y(h.row) - (before ? g.y(before.row) : g.y(h.row))));
    const leaveAt = delay + (hop ? HOP_LIFT_MS : 0);
    const action: MapAction | null =
      moved && !reduce ? { kind: hop ? "hop" : "move", key: `${h.oid}-${play}`, delayMs: delay, durationMs: travel } : null;
    return (
      <motion.g
        key={`robot:${h.actor}`}
        initial={appeared ? { x, y: y - 30, opacity: 0 } : false}
        animate={{ x, y, opacity: 1 }}
        transition={moved || appeared ? { ...glide(leaveAt), type: "tween", duration: reduce ? 0 : travel / 1000, ease: "easeInOut" } : glide(moveAt(target))}
      >
        <title>{`${actorName(h.actor)} ${h.detached ? `(detached at ${h.oid.slice(0, 7)})` : `on ${h.branch}`}${h.conflicted ? ", has a conflict" : ""}`}</title>
        <ellipse cx={0} cy={0.5} rx={markerWidth(h.actor) * 0.36} ry={2.6} fill={TOKENS["shadow-dark"]} opacity={0.16} />
        <motion.g
          key={`hop-${h.oid}-${play}`}
          initial={{ y: 0 }}
          animate={hop && !reduce ? { y: [0, -12, 0] } : { y: 0 }}
          transition={hop && !reduce ? { delay: sec(leaveAt), duration: HOP_FLIGHT_MS / 1000, times: [0, 0.45, 1], ease: "easeOut" } : { duration: 0 }}
        >
          <RobotMarker actor={h.actor} mood={mood} facing={facing} still={reduce} action={action} />
        </motion.g>
        <AnimatePresence>
          {h.conflicted && (
            <motion.g
              key="warn"
              initial={prev ? { scale: 0, opacity: 0 } : false}
              animate={reduce ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, rotate: [0, -12, 10, -6, 0] }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ delay: sec(conflictAt), type: "spring", stiffness: 380, damping: 12, rotate: { delay: sec(conflictAt + 200), duration: 0.6, repeat: reduce ? 0 : 2, repeatDelay: 1.4 } }}
              style={{ originX: "50%", originY: "100%" }}
            >
              <g transform="translate(-24 -74) scale(1.3)">
                <path d="M0 -11 L11 8 L-11 8 Z" fill={WARN} stroke={WHITE} strokeWidth={2} strokeLinejoin="round" />
                <rect x={-1.3} y={-5} width={2.6} height={7} rx={1.3} fill={WHITE} />
                <circle cx={0} cy={4.6} r={1.5} fill={WHITE} />
              </g>
            </motion.g>
          )}
        </AnimatePresence>
      </motion.g>
    );
  });
}

/** Robot names beside each group of robots: to the right, or to the left when the next group is too close. */
export function MapRobotNames({ scene }: { scene: MapScene }) {
  const { g, prev, schedule, stopsByOid, headsByOid, slots, glide, moveAt, isNew } = scene;
  const groups = [...headsByOid.entries()].map(([oid, hs]) => {
    const s = stopsByOid.get(oid)!;
    return { oid, hs, s, x: g.x(s.col), y: g.y(s.row) };
  });
  return groups.map(({ oid, hs, s, x, y }) => {
    const delay = Math.max(...hs.map((h) => schedule.actorMove.get(h.actor) ?? moveAt(s))) + (isNew(oid) ? POP_DELAY_MS : 0);
    const labels = hs.map((h) => (h.detached ? `${actorName(h.actor)} · detached` : actorName(h.actor)));
    const widths = labels.map(nameWidth);
    const others = groups
      .filter((o) => o.oid !== oid)
      .map((o) => ({ lo: o.x + slots.left(o.oid), hi: o.x + slots.right(o.oid), y: o.y }));
    const { side, x: ax } = nameSide({ x, y, left: slots.left(oid), right: slots.right(oid), reach: Math.max(...widths) + 8 }, others);
    return (
      <motion.g
        key={`names:${hs.map((h) => h.actor).join(",")}`}
        initial={prev ? { x: ax, y, opacity: 0 } : false}
        animate={{ x: ax, y, opacity: 1 }}
        transition={glide(delay)}
      >
        {hs.map((h, i) => {
          const c = actorColor(h.actor);
          const w = widths[i];
          // Stacked beside the robots' heads, low enough that three names stay inside the map.
          const ly = -30 - (hs.length - 1 - i) * 20;
          return (
            <g key={h.actor} transform={`translate(${side === "left" ? -w : 0} ${ly})`}>
              <rect x={0} y={-9} width={w} height={18} rx={9} fill={WHITE} stroke={c.line} strokeWidth={1.4} />
              <circle cx={9} cy={0} r={3.2} fill={c.line} />
              <text x={16} y={4} fontSize={11.5} fontWeight={650} fill={INK}>{labels[i]}</text>
            </g>
          );
        })}
      </motion.g>
    );
  });
}
