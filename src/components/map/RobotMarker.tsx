"use client";

// A crew member on the history map. Robots are Pocket Machines sprites; the player is a pawn.
// Origin is the ground anchor (between the feet), facing right. Renders an SVG <g>.

import { useEffect, useState } from "react";
import type { ActorId, Mood } from "@/engine/types";
import { moodState, isSpriteRobot } from "@/components/robots/moods";
import { PlayerMarker } from "@/components/robots/PlayerMarker";
import { SvgSprite, type Facing } from "@/components/robots/Sprite";
import type { SpriteRobot } from "@/components/robots/sheets.generated";

export type { Facing };

/** A one-off movement to play: hop onto a new commit, or roll/walk along the line. */
export type MapAction = { kind: "hop" | "move"; key: string; delayMs: number; durationMs: number };

export type RobotMarkerProps = {
  actor: ActorId;
  mood: Mood;
  facing: Facing;
  /** Show a single frame (reduced motion). */
  still?: boolean;
  action?: MapAction | null;
};

/** Height of a robot's resting artwork in map units. */
export const ROBOT_HEIGHT = 64;
/** The player's pawn is shorter than the robots. */
export const PLAYER_HEIGHT = 40;

/**
 * Roughly how wide each marker is on the map, used to space markers that share a stop.
 * From the idle artwork at ROBOT_HEIGHT.
 */
export const MARKER_WIDTH: Record<string, number> = { player: 28, tidy: 46, blaze: 54, drift: 48, hoarder: 62 };
export const markerWidth = (actor: ActorId) => MARKER_WIDTH[actor] ?? MARKER_WIDTH.player;

export function RobotMarker({ actor, mood, facing, still = false, action = null }: RobotMarkerProps) {
  if (!isSpriteRobot(actor)) {
    return (
      <g transform={facing === "left" ? "scale(-1 1)" : undefined}>
        <PlayerMarker actor={actor} height={PLAYER_HEIGHT} />
      </g>
    );
  }
  return <MapRobot robot={actor} mood={mood} facing={facing} still={still} action={action} />;
}

function MapRobot({ robot, mood, facing, still, action }: { robot: SpriteRobot; mood: Mood; facing: Facing; still: boolean; action: MapAction | null }) {
  const [active, setActive] = useState<{ kind: MapAction["kind"]; key: string } | null>(null);
  const key = action?.key;
  const kind = action?.kind;
  const delayMs = action?.delayMs ?? 0;
  const durationMs = action?.durationMs ?? 0;

  useEffect(() => {
    if (!key || !kind || still) return;
    const start = window.setTimeout(() => setActive({ kind, key }), delayMs);
    // A hop ends with its own animation; a move ends when the glide along the line does.
    const stop = kind === "move" ? window.setTimeout(() => setActive((a) => (a?.key === key ? null : a)), delayMs + durationMs) : 0;
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
    };
  }, [key, kind, delayMs, durationMs, still]);

  const rest = moodState(robot, mood);
  const state = active ? active.kind : rest;
  return (
    <SvgSprite
      robot={robot}
      state={state}
      facing={facing}
      size="map"
      artHeight={ROBOT_HEIGHT}
      still={still}
      playKey={active?.key ?? "mood"}
      rest={active?.kind === "hop" ? rest : undefined}
      onEnd={active?.kind === "hop" ? () => setActive(null) : undefined}
    />
  );
}
