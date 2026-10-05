"use client";

// Placeholder robot marker. Deliberately simple geometric shapes until the real character art
// lands; anything that renders an <g> with the same props can replace it.
// Origin is the point between the feet, facing right. Height is about 42 units.

import { motion } from "motion/react";
import type { ActorId, Mood } from "@/engine/types";
import { INK, actorColor } from "./palette";

export type Facing = "left" | "right";

export type RobotMarkerProps = {
  actor: ActorId;
  mood: Mood;
  facing: Facing;
  /** Turn off idle motion such as blinking (reduced motion). */
  still?: boolean;
};

export const ROBOT_HEIGHT = 42;

type Shape = { bodyW: number; bodyH: number; radius: number };

const SHAPES: Record<string, Shape> = {
  player: { bodyW: 28, bodyH: 26, radius: 13 },
  tidy: { bodyW: 28, bodyH: 26, radius: 8 },
  blaze: { bodyW: 28, bodyH: 25, radius: 6 },
  drift: { bodyW: 30, bodyH: 28, radius: 15 },
  hoarder: { bodyW: 34, bodyH: 25, radius: 6 },
};

function Eyes({ mood, cx, cy, still }: { mood: Mood; cx: number; cy: number; still: boolean }) {
  const l = cx - 5;
  const r = cx + 5;
  switch (mood) {
    case "happy":
    case "celebrate":
      return (
        <g stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none">
          <path d={`M${l - 2.5} ${cy + 1} Q${l} ${cy - 3} ${l + 2.5} ${cy + 1}`} />
          <path d={`M${r - 2.5} ${cy + 1} Q${r} ${cy - 3} ${r + 2.5} ${cy + 1}`} />
        </g>
      );
    case "scared":
      return (
        <g>
          <circle cx={l} cy={cy} r={3.6} fill="#fff" stroke={INK} strokeWidth={1.2} />
          <circle cx={r} cy={cy} r={3.6} fill="#fff" stroke={INK} strokeWidth={1.2} />
          <circle cx={l} cy={cy} r={1.2} fill={INK} />
          <circle cx={r} cy={cy} r={1.2} fill={INK} />
        </g>
      );
    case "guilty":
      return (
        <g fill={INK}>
          <rect x={l - 2} y={cy + 0.5} width={3.4} height={3.2} rx={1.6} />
          <rect x={r - 2} y={cy + 0.5} width={3.4} height={3.2} rx={1.6} />
          <path d={`M${l - 3} ${cy - 3} L${l + 2} ${cy - 1.5}`} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
          <path d={`M${r + 3} ${cy - 3} L${r - 2} ${cy - 1.5}`} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
        </g>
      );
    case "thinking":
      return (
        <g fill={INK}>
          <rect x={l - 1.7} y={cy - 4} width={3.4} height={5} rx={1.7} />
          <path d={`M${r - 2.5} ${cy} L${r + 2.5} ${cy}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <motion.g
          fill={INK}
          style={{ transformOrigin: "50% 50%", transformBox: "fill-box" }}
          animate={still ? undefined : { scaleY: [1, 1, 0.1, 1] }}
          transition={still ? undefined : { duration: 4.2, times: [0, 0.94, 0.97, 1], repeat: Infinity }}
        >
          <rect x={l - 1.7} y={cy - 3} width={3.4} height={6} rx={1.7} />
          <rect x={r - 1.7} y={cy - 3} width={3.4} height={6} rx={1.7} />
          {mood === "talking" && <ellipse cx={cx} cy={cy + 5.5} rx={2.2} ry={1.4} />}
        </motion.g>
      );
  }
}

export function RobotMarker({ actor, mood, facing, still = false }: RobotMarkerProps) {
  const c = actorColor(actor);
  const s = SHAPES[actor] ?? SHAPES.tidy;
  const top = -4 - s.bodyH;
  const left = -s.bodyW / 2;
  const screenX = left + 4;
  const screenW = s.bodyW - 8;
  const screenY = top + 4;
  const screenH = 14;
  const eyeCx = screenX + screenW / 2 + 1.5;
  const eyeCy = screenY + screenH / 2;

  return (
    <g transform={facing === "left" ? "scale(-1 1)" : undefined}>
      <ellipse cx={0} cy={0.5} rx={s.bodyW / 2 - 1} ry={2.6} fill="#3B2F1E" opacity={0.16} />
      {/* legs */}
      <rect x={-8} y={-6} width={5} height={6} rx={2} fill={c.deep} />
      <rect x={3} y={-6} width={5} height={6} rx={2} fill={c.deep} />

      {/* per-robot silhouette details, behind the body */}
      {actor === "hoarder" && <rect x={left - 7} y={top + 3} width={10} height={s.bodyH - 6} rx={3} fill={c.deep} />}
      {actor === "blaze" && (
        <path d={`M${left + 6} ${top + 2} L${left + 10} ${top - 9} L${left + 15} ${top - 1} L${left + 20} ${top - 7} L${left + 22} ${top + 2} Z`} fill={c.deep} />
      )}
      {(actor === "tidy" || actor === "player" || !SHAPES[actor]) && (
        <g>
          <line x1={0} y1={top} x2={0} y2={top - 7} stroke={c.deep} strokeWidth={2} strokeLinecap="round" />
          <circle cx={0} cy={top - 8.5} r={2.8} fill={actor === "player" ? "#fff" : c.line} stroke={c.deep} strokeWidth={1.4} />
        </g>
      )}
      {actor === "drift" && (
        <g>
          <path d={`M-2 ${top + 1} C-2 ${top - 6} 6 ${top - 6} 6 ${top - 12}`} stroke={c.deep} strokeWidth={2} fill="none" strokeLinecap="round" />
          <circle cx={6} cy={top - 13} r={2.6} fill="#fff" stroke={c.deep} strokeWidth={1.4} />
        </g>
      )}

      {/* body */}
      <rect x={left} y={top} width={s.bodyW} height={s.bodyH} rx={s.radius} fill={c.line} />
      <rect x={left} y={top + s.bodyH - 6} width={s.bodyW} height={6} rx={3} fill={c.deep} opacity={0.35} />
      {actor === "player" && <rect x={left - 2} y={top + 9} width={4} height={8} rx={2} fill={c.deep} />}
      <rect x={screenX} y={screenY} width={screenW} height={screenH} rx={actor === "drift" ? 7 : 4.5} fill={c.tint} />
      <Eyes mood={mood} cx={eyeCx} cy={eyeCy} still={still} />
      {(mood === "scared") && (
        <path d={`M${left + s.bodyW + 3} ${top + 2} q2 4 0 6 q-2 -2 0 -6 z`} fill="#7CC4F0" />
      )}
    </g>
  );
}
