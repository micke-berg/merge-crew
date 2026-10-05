"use client";

import { motion } from "motion/react";
import type { Oid } from "@/engine/types";
import { GHOST, INK, INK_SOFT, TOKENS, WARN, WHITE, actorColor } from "@/lib/palette";
import { monoWidth } from "./geometry";
import { POP_DELAY_MS } from "./motion";
import { MONO, STOP_R, laneColor, type MapScene } from "./scene";
import { labelAtLineEnd, tagTitle, type Tag, type TagKind } from "./tags";

/** Branch names at the end of their line, in the line's colour. */
export function LineEndLabels({ scene }: { scene: MapScene }) {
  const { layout, g, prev, schedule, lanes, glide, isNew, headsByOid, slots } = scene;
  return layout.branchLabels
    .filter((b) => labelAtLineEnd(layout, b))
    .map((b) => {
      const c = laneColor(lanes.get(b.laneId));
      const w = monoWidth(b.name, 12) + 20;
      const at = schedule.branch.get(b.name);
      const delay = at ? at.at + (isNew(b.oid) ? POP_DELAY_MS : 0) : 0;
      return (
        <motion.g
          key={`label:${b.name}`}
          initial={prev && !prev.branchLabels.some((p) => p.name === b.name) ? { x: g.x(b.col), y: g.y(b.row), opacity: 0 } : false}
          animate={{ x: g.x(b.col), y: g.y(b.row), opacity: 1 }}
          transition={glide(delay, at?.motion === "snap" ? "snap" : "soft")}
        >
          <g transform={`translate(${STOP_R + 10 + (headsByOid.has(b.oid) ? slots.right(b.oid) + 4 : 0)} 0)`}>
            <rect x={0} y={-11} width={w} height={22} rx={11} fill={c.deep} />
            <text x={10} y={4} fontSize={12} fontWeight={700} fontFamily={MONO} fill={WHITE}>{b.name}</text>
          </g>
        </motion.g>
      );
    });
}

function tagStyle(kind: TagKind, actorLine: string) {
  switch (kind) {
    case "branch": return { fill: WHITE, stroke: actorLine, text: INK, dash: undefined };
    case "remote": return { fill: TOKENS["tag-remote"], stroke: TOKENS.divider, text: INK, dash: undefined };
    case "tracking": return { fill: "transparent", stroke: GHOST, text: INK_SOFT, dash: "3 3" };
    case "stash": return { fill: TOKENS["tag-stash"], stroke: actorColor("hoarder").line, text: INK, dash: "4 3" };
  }
}

const TAG_FONT = 10.5;

/** Branch tags, remote tags and stashes, stacked under their stop. */
export function StopTags({ scene, tags }: { scene: MapScene; tags: Map<Oid, Tag[]> }) {
  const { g, prevStops, prev, schedule, reduce, play, stopsByOid, sec, glide, moveAt } = scene;
  return [...tags.entries()].flatMap(([oid, list]) => {
    const s = stopsByOid.get(oid);
    if (!s) return [];
    return list.map((t, i) => {
      const w = monoWidth(t.text, TAG_FONT) + 24;
      const y = g.y(s.row) + STOP_R + 30 + i * 19;
      const remote = t.ref ? schedule.remote.get(t.ref) : undefined;
      const branch = t.kind === "branch" ? schedule.branch.get(t.text) : undefined;
      const delay = remote?.at ?? branch?.at ?? moveAt(s);
      const c = actorColor(t.actor);
      const style = tagStyle(t.kind, c.line);
      return (
        <motion.g
          key={t.key}
          initial={prev && !prevStops.has(oid) ? { x: g.x(s.col), y, opacity: 0 } : false}
          animate={{ x: g.x(s.col), y, opacity: 1 }}
          transition={glide(delay, branch?.motion === "snap" || remote?.forced ? "snap" : "soft")}
        >
          <title>{tagTitle(t)}</title>
          <rect x={-w / 2} y={-9} width={w} height={18} rx={9} fill={style.fill} stroke={style.stroke} strokeWidth={1.4} strokeDasharray={style.dash} />
          {t.kind === "branch" && <circle cx={-w / 2 + 9} cy={0} r={3} fill={c.line} />}
          {(t.kind === "remote" || t.kind === "tracking") && (
            <path d={`M${-w / 2 + 6} 2.5 a2.6 2.6 0 0 1 1.2-4.9 a3.4 3.4 0 0 1 6.4 0.6 a2.2 2.2 0 0 1 0.2 4.3 z`} fill={t.kind === "remote" ? INK_SOFT : "none"} stroke={INK_SOFT} strokeWidth={0.9} />
          )}
          <text x={-w / 2 + 17} y={3.6} fontSize={TAG_FONT} fontFamily={MONO} fontWeight={600} fill={style.text}>{t.text}</text>
          {remote?.forced && !reduce && (
            <motion.g
              key={`forced-${play}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1, 1] }}
              transition={{ delay: sec(remote.at), duration: 2.4, times: [0, 0.12, 0.8, 1] }}
            >
              <rect x={w / 2 + 6} y={-10} width={96} height={20} rx={10} fill={WARN} />
              <text x={w / 2 + 54} y={4} textAnchor="middle" fontSize={11} fontWeight={800} fill={WHITE} letterSpacing="0.04em">FORCE-PUSHED</text>
            </motion.g>
          )}
        </motion.g>
      );
    });
  });
}
