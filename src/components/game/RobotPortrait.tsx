"use client";

import type { ActorId, Mood } from "@/engine/types";
import { actorColor } from "@/components/map/palette";
import { isSpriteRobot, moodState, type Rest } from "@/components/robots/moods";
import { PlayerMarker } from "@/components/robots/PlayerMarker";
import { Sprite, spriteBox } from "@/components/robots/Sprite";
import type { SpriteState } from "@/components/robots/sheets.generated";

type Props = {
  actor: ActorId;
  mood?: Mood;
  /** Play this animation instead of the mood's, e.g. a signature move on hover. */
  animation?: SpriteState;
  rest?: Rest;
  playKey?: string | number;
  size?: number;
  still?: boolean;
  /** Draw the round tinted backdrop. */
  framed?: boolean;
  className?: string;
};

/** How tall the artwork is relative to the portrait circle. Heads pop a little out of the top. */
const ART_FILL = 0.9;
/** Where the feet rest, from the top of the circle. */
const GROUND = 0.94;

/** A crew member drawn on its own, for dialogue lines, the brief, the crew cards and the win panel. */
export function RobotPortrait({ actor, mood = "idle", animation, rest, playKey, size = 56, still = false, framed = true, className }: Props) {
  const c = actorColor(actor);
  const robot = isSpriteRobot(actor) ? actor : null;
  const box = spriteBox(size * ART_FILL);
  return (
    <span
      className={`relative inline-block shrink-0 rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: framed ? c.tint : undefined,
        boxShadow: framed ? `inset 0 0 0 2px ${c.line}33` : undefined,
      }}
      aria-hidden
    >
      {robot ? (
        <Sprite
          robot={robot}
          state={animation ?? moodState(robot, mood)}
          rest={rest}
          playKey={playKey}
          size="portrait"
          artHeight={size * ART_FILL}
          still={still}
          className="pointer-events-none absolute"
          style={{ left: size / 2 - box.anchorX, top: size * GROUND - box.anchorY }}
        />
      ) : (
        <svg
          viewBox="-20 -42 40 44"
          width={size * 0.66}
          height={size * 0.66 * 1.1}
          className="pointer-events-none absolute overflow-visible"
          style={{ left: size * 0.17, top: size * GROUND - size * 0.66 * 1.1 * (42 / 44) }}
        >
          <PlayerMarker actor={actor} />
        </svg>
      )}
    </span>
  );
}
