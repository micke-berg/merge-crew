"use client";

import { motion } from "motion/react";
import { edgePath, monoWidth } from "./geometry";
import type { ResolvedFocus } from "./focus";
import { STOP_R, LINE_W, type MapScene } from "./scene";

type Props = { scene: MapScene; focus: ResolvedFocus; accent: string };

/** A slow breath for the highlight; a steady glow with reduced motion. */
function pulse(reduce: boolean, low: number, high: number) {
  return reduce
    ? { animate: { opacity: high }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: [low, high, low] },
        transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" as const },
      };
}

/**
 * Drawn under the lines: a soft glow along each highlighted branch line, its stops and its name.
 * The line itself stays on top, so the glow reads as light behind it.
 */
export function MapFocusUnder({ scene, focus, accent }: Props) {
  const { layout, g, stopsByOid, headsByOid, slots, reduce } = scene;
  if (focus.lanes.length === 0) return null;
  const ids = new Set(focus.lanes.map((l) => l.id));
  const edges = layout.edges.filter((e) => ids.has(e.laneId) && !e.lost);
  const stops = layout.stops.filter((s) => ids.has(s.laneId));
  const labels = layout.branchLabels.filter((b) => ids.has(b.laneId) && focus.lanes.some((l) => l.name === b.name));
  return (
    <motion.g key={[...ids].join(",")} pointerEvents="none" {...pulse(reduce, 0.22, 0.5)}>
      {edges.map((e) => (
        <path
          key={e.id}
          d={edgePath(e.kind, g.x(e.fromCol), g.y(e.fromRow), g.x(e.toCol), g.y(e.toRow), g.colGap)}
          fill="none" stroke={accent} strokeWidth={LINE_W + 16} strokeLinecap="round" strokeLinejoin="round"
        />
      ))}
      {stops.map((s) => (
        <circle key={s.oid} cx={g.x(s.col)} cy={g.y(s.row)} r={STOP_R + 11} fill={accent} />
      ))}
      {labels.map((b) => {
        const s = stopsByOid.get(b.oid);
        if (!s) return null;
        const left = g.x(s.col) + STOP_R + 10 + (headsByOid.has(b.oid) ? slots.right(b.oid) + 4 : 0);
        const w = monoWidth(b.name, 12) + 20;
        return <rect key={b.name} x={left - 6} y={g.y(s.row) - 17} width={w + 12} height={34} rx={17} fill={accent} />;
      })}
    </motion.g>
  );
}

/**
 * A ring around each highlighted commit and an outline round the lost band. Drawn in two parts: the
 * soft fill over the stops, and the ring over the robots, so a robot standing on the commit cannot hide it.
 */
export function MapFocusOver({ scene, focus, accent, part }: Props & { part: "fill" | "ring" }) {
  const { layout, g, stopsByOid, reduce } = scene;
  const ghostY = layout.ghostRow !== null ? g.y(layout.ghostRow) : null;
  return (
    <g pointerEvents="none">
      {focus.stops.map((oid) => {
        const s = stopsByOid.get(oid);
        if (!s) return null;
        return (
          <g key={oid} transform={`translate(${g.x(s.col)} ${g.y(s.row)})`}>
            {part === "fill" ? (
              <motion.circle r={STOP_R + 14} fill={accent} {...pulse(reduce, 0.12, 0.3)} />
            ) : (
              <circle r={STOP_R + 11} fill="none" stroke={accent} strokeWidth={3} />
            )}
          </g>
        );
      })}
      {part === "fill" && focus.lost && ghostY !== null && (
        <g>
          <motion.rect
            x={6} y={ghostY - 32} width={g.width - 12} height={64} rx={32}
            fill={accent} {...pulse(reduce, 0.06, 0.16)}
          />
          <rect
            x={8} y={ghostY - 30} width={g.width - 16} height={60} rx={30}
            fill="none" stroke={accent} strokeWidth={3}
          />
        </g>
      )}
    </g>
  );
}
