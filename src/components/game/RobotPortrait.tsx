"use client";

import type { ActorId, Mood } from "@/engine/types";
import { RobotMarker } from "@/components/map/RobotMarker";
import { actorColor } from "@/components/map/palette";

type Props = {
  actor: ActorId;
  mood?: Mood;
  size?: number;
  still?: boolean;
  /** Draw the round tinted backdrop. */
  framed?: boolean;
  className?: string;
};

/** A robot drawn on its own, for dialogue lines, the brief and the win panel. */
export function RobotPortrait({ actor, mood = "idle", size = 56, still = false, framed = true, className }: Props) {
  const c = actorColor(actor);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: framed ? c.tint : undefined,
        boxShadow: framed ? `inset 0 0 0 2px ${c.line}33` : undefined,
      }}
      aria-hidden
    >
      <svg viewBox="-27 -50 54 56" width={size * 0.86} height={size * 0.86} className="overflow-visible">
        <RobotMarker actor={actor} mood={mood} facing="right" still={still} />
      </svg>
    </span>
  );
}
