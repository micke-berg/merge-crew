// Plays a stuck case through the real game and returns the hint request the game would send.

import { begin, runPlayerCommand, skipScript, startLevel, type GameState } from "@/components/game/game";
import { buildHintRequest } from "@/components/game/hintRequest";
import { getLevel } from "@/levels";
import type { HintRequest } from "@/hints/types";
import type { StuckCase } from "./cases";

export function playCase(c: StuckCase): GameState {
  const level = getLevel(c.levelId);
  if (!level) throw new Error(`unknown level ${c.levelId}`);
  let game = skipScript(begin(startLevel(level)));
  for (const line of c.commands) game = runPlayerCommand(game, line).state;
  return game;
}

export function caseRequest(c: StuckCase, hintNumber = 1): HintRequest {
  return buildHintRequest(playCase(c), hintNumber);
}
