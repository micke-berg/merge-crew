// Which animation each mood plays. Pure, so it is tested without a browser.

import type { ActorId, Mood } from "@/engine/types";
import { ANIMATIONS, FRAMES, ROBOTS, type SpriteRobot, type SpriteState } from "./sheets.generated";

export function isSpriteRobot(actor: ActorId | null | undefined): actor is SpriteRobot {
  return !!actor && (ROBOTS as readonly string[]).includes(actor);
}

/**
 * Mood -> animation. Celebrating plays each robot's signature where the signature reads as a win
 * (Tidy squares a neat stack, Blaze pulls a wheelie, Hoarder hugs its files). Drift's signature is
 * forgetting what it was doing, so Drift celebrates with the plain happy cycle. Surprise uses the
 * scared cycle: wide eyes and raised hands read as surprise, the happy one reads as a cheer.
 */
export function moodState(robot: SpriteRobot, mood: Mood): SpriteState {
  switch (mood) {
    case "idle": return "idle";
    case "talking": return "talk";
    case "thinking": return "thinking";
    case "happy": return "happy";
    case "celebrate": return robot === "drift" ? "happy" : "signature";
    case "scared":
    case "surprised": return "scared";
    case "guilty": return "guilty";
  }
}

/**
 * What a one-shot animation turns into when it ends: "hold" keeps its last frame. A guilty look
 * stays guilty; everything else settles back to idle.
 */
export type Rest = SpriteState | "hold";

export function restAfter(state: SpriteState): Rest {
  if (ANIMATIONS[state].loop) return state;
  return state === "guilty" ? "hold" : "idle";
}

/** The frame shown when motion is reduced: the clearest single pose of each state. */
export const STILL_FRAME: Record<SpriteState, number> = {
  idle: 0, move: 0, hop: 0, talk: 0, happy: 1, scared: 0, guilty: 3, thinking: 0, signature: 2,
};

/** Seconds one pass of a state takes. */
export const cycleSeconds = (state: SpriteState) => FRAMES / ANIMATIONS[state].fps;
