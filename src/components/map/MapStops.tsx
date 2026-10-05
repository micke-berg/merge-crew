"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Oid } from "@/engine/types";
import { GHOST, INK, INK_SOFT, TOKENS, WHITE, actorName } from "@/lib/palette";
import { OID_LABEL_MIN_GAP } from "./geometry";
import type { Stop } from "./layout";
import { POP_DELAY_MS } from "./motion";
import { MONO, STOP_R, laneColor, type MapScene } from "./scene";

/** One-line description of a commit, for tooltips and the commit list. */
export function describeStop(s: Stop): string {
  return `${s.short} ${s.message} (${actorName(s.author)})${s.lost ? ", lost" : ""}`;
}

/** The commits: a ring per stop, cracked when lost, with its short id underneath. */
export function MapStops({ scene, hover, onHover }: { scene: MapScene; hover: Oid | null; onHover: (oid: Oid, over: boolean) => void }) {
  const { layout, g, prev, schedule, reduce, lanes, sec, glide, moveAt, appearAt, isNew } = scene;
  const labelled = new Set(layout.branchLabels.map((b) => b.oid));
  const tips = new Set([...labelled, ...layout.heads.map((h) => h.oid)]);
  const showOid = (s: Stop) => g.colGap >= OID_LABEL_MIN_GAP || hover === s.oid || labelled.has(s.oid);

  return layout.stops.map((s) => {
    const color = s.lost ? GHOST : laneColor(lanes.get(s.laneId)).line;
    const r = s.merge ? STOP_R + 2 : tips.has(s.oid) ? STOP_R + 1.2 : STOP_R;
    const loseAt = schedule.lose.get(s.oid);
    const recoverAt = schedule.recover.get(s.oid);
    return (
      <motion.g
        key={s.oid}
        initial={false}
        animate={{ x: g.x(s.col), y: g.y(s.row) }}
        transition={glide(moveAt(s), loseAt !== undefined ? "drop" : recoverAt !== undefined ? "lift" : "soft")}
        onMouseEnter={() => onHover(s.oid, true)}
        onMouseLeave={() => onHover(s.oid, false)}
        style={{ cursor: "default" }}
      >
        <title>{describeStop(s)}</title>
        <motion.g
          initial={isNew(s.oid) ? { scale: 0 } : false}
          animate={loseAt !== undefined && !reduce ? { scale: 1, rotate: [0, -8, 7, -4, 0] } : { scale: 1, rotate: 0 }}
          transition={
            loseAt !== undefined && !reduce
              ? { rotate: { delay: sec(loseAt), duration: 0.42 }, scale: { duration: 0 } }
              : { delay: sec(appearAt(s.oid) + POP_DELAY_MS), type: "spring", stiffness: 420, damping: 14 }
          }
        >
          <circle r={r + 7} fill="transparent" />
          <motion.circle
            r={r}
            initial={false}
            animate={{ stroke: color, fill: s.lost ? TOKENS["ghost-fill"] : WHITE }}
            transition={{ delay: sec(loseAt ?? recoverAt ?? 0), duration: sec(250) }}
            strokeWidth={s.merge ? 4 : 3.5}
            strokeDasharray={s.lost ? "3 2.4" : undefined}
          />
          {s.merge && !s.lost && <circle r={2.6} fill={INK} />}
          <AnimatePresence>
            {s.lost && (
              <motion.path
                key="crack"
                d={`M${-r - 1} ${-r + 1} L${-1.5} ${-1} L${-3.5} ${2.5} L${r + 1} ${r}`}
                fill="none" stroke={INK_SOFT} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
                initial={prev && loseAt !== undefined ? { pathLength: 0 } : false}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0, transition: { delay: sec(recoverAt ?? 0), duration: sec(300) } }}
                transition={{ delay: sec(loseAt ?? 0), duration: sec(260) }}
              />
            )}
          </AnimatePresence>
        </motion.g>
        {showOid(s) && (
          <text y={r + 15} textAnchor="middle" fontSize={10} fontFamily={MONO} fill={INK_SOFT}>
            {s.short}
          </text>
        )}
      </motion.g>
    );
  });
}
