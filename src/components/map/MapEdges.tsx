"use client";

import { motion } from "motion/react";
import { GHOST, PAPER } from "@/lib/palette";
import { edgePath } from "./geometry";
import { LINE_W, laneColor, type MapScene } from "./scene";

/** Line casings, then lines: the paper-coloured casing separates lines that cross. */
export function MapEdges({ scene }: { scene: MapScene }) {
  return (
    <>
      <EdgeLayer scene={scene} layer="casing" />
      <EdgeLayer scene={scene} layer="line" />
    </>
  );
}

function EdgeLayer({ scene, layer }: { scene: MapScene; layer: "casing" | "line" }) {
  const { layout, g, prev, lanes, stopsByOid, sec, glide, moveAt, appearAt } = scene;
  const prevEdges = new Set((prev?.edges ?? []).map((e) => e.id));
  return (
    <g filter={layer === "line" ? `url(#${scene.filterId})` : undefined}>
      {layout.edges.map((e) => {
        const lane = lanes.get(e.laneId);
        const d = edgePath(e.kind, g.x(e.fromCol), g.y(e.fromRow), g.x(e.toCol), g.y(e.toRow), g.colGap);
        const delay = Math.max(moveAt(stopsByOid.get(e.from)!), moveAt(stopsByOid.get(e.to)!));
        const fresh = !!prev && !prevEdges.has(e.id) && !e.lost;
        const dashed = e.lost || lane?.kind === "remote" || lane?.kind === "detached" || lane?.kind === "stash";
        const color = e.lost ? GHOST : laneColor(lane).line;
        const width = e.lost ? 3 : lane?.kind === "stash" || lane?.kind === "detached" ? 4 : LINE_W;
        if (layer === "casing") {
          return e.lost ? null : (
            <motion.path
              key={e.id}
              initial={fresh ? { d, opacity: 0 } : false}
              animate={{ d, opacity: 1 }}
              transition={{ d: glide(delay, e.kind === "straight" ? "snap" : "soft"), opacity: { delay: sec(appearAt(e.to)), duration: 0.01 } }}
              fill="none" stroke={PAPER} strokeWidth={width + 6} strokeLinecap="round" strokeLinejoin="round"
            />
          );
        }
        return (
          <motion.path
            key={e.id}
            initial={fresh && !dashed ? { d, pathLength: 0 } : false}
            animate={fresh && !dashed ? { d, pathLength: 1, stroke: color } : { d, stroke: color }}
            transition={{
              d: glide(delay, e.lost ? "drop" : "soft"),
              pathLength: { delay: sec(appearAt(e.to)), duration: sec(360), ease: "easeOut" },
              stroke: { delay: sec(delay), duration: sec(300) },
            }}
            fill="none" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={dashed ? (e.lost ? "1 7" : "10 7") : undefined}
            opacity={e.lost ? 0.85 : 1}
          />
        );
      })}
    </g>
  );
}
