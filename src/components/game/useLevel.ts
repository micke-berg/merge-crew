"use client";

// React driver for game.ts: runs its level reducer and owns the timers that play scenes step by step.

import { useEffect, useReducer, useRef } from "react";
import { useReducedMotion } from "motion/react";
import type { Level } from "@/engine/types";
import { buildSchedule } from "@/components/map/timeline";
import {
  canAskHint,
  hintBubble,
  hintsLeft,
  initLevelModel,
  levelReducer,
  nextHintKey,
  shownBubble,
  type GameState,
  type PointStep,
  type Wait,
} from "./game";
import { buildHintRequest, fetchHint, newRunId } from "./hintRequest";
import { markLevelComplete } from "./progress";

/** How long to hold after a scripted git step so its animation can play. */
function waitMs(wait: Wait, game: GameState, reduce: boolean): number | null {
  switch (wait.kind) {
    case "click":
      return null;
    case "none":
      return 0;
    case "ms":
      return reduce ? Math.min(wait.ms, 250) : wait.ms;
    case "animate":
      return reduce ? 250 : buildSchedule(wait.events, game.repo).duration + 550;
  }
}

export function useLevel(level: Level) {
  const [model, dispatch] = useReducer(levelReducer, level, initLevelModel);
  const reduce = useReducedMotion() ?? false;
  const { game, wait } = model;
  const inScene = game.phase === "intro" || game.phase === "outro";
  const touring = model.tour !== null;

  useEffect(() => {
    if (!inScene) return;
    const ms = waitMs(wait, game, reduce);
    if (ms === null) return;
    const t = window.setTimeout(() => dispatch({ type: "step" }), ms);
    return () => window.clearTimeout(t);
  }, [game, wait, inScene, reduce]);

  useEffect(() => {
    if (game.phase === "won") markLevelComplete(game.level.id);
  }, [game.phase, game.level.id]);

  // The latest model, for the hint request (built from the state at the moment the player asks).
  const latest = useRef(model);
  const runIdFor = useRef<{ run: number; id: string }>({ run: -1, id: "" });
  useEffect(() => {
    latest.current = model;
  }, [model]);
  const askHint = () => {
    const m = latest.current;
    if (!canAskHint(m)) return;
    const key = nextHintKey(m);
    // One random id per play of the level; a restart starts a new one.
    if (runIdFor.current.run !== m.run) runIdFor.current = { run: m.run, id: newRunId() };
    const request = buildHintRequest(m.game, m.hintsUsed + 1, runIdFor.current.id);
    dispatch({ type: "hint-ask" });
    void fetchHint(request).then(({ text, refund }) => dispatch({ type: "hint-answer", key, text, refund }));
  };

  return {
    game,
    run: model.run,
    /** The robot line on screen: the scene's, or the screen tour's while it shows. */
    bubble: shownBubble(model),
    /** True while the "?" screen tour plays over the player turn. */
    touring,
    /** Position in the tour, for the dialogue's typewriter key. */
    tourAt: model.tour?.at ?? -1,
    /** True while a robot line is on screen and waits for the player to read it. */
    awaitingClick: touring || (inScene && wait.kind === "click"),
    /** Play the screen tour over the player turn. */
    tour: (steps: PointStep[]) => dispatch({ type: "tour", steps }),
    begin: () => dispatch({ type: "begin" }),
    next: () => dispatch({ type: "continue" }),
    skip: () => dispatch({ type: "skip" }),
    command: (line: string) => dispatch({ type: "command", line }),
    /** Save a working file from the conflict editor. */
    edit: (path: string, content: string) => dispatch({ type: "edit", path, content }),
    restart: () => dispatch({ type: "restart", level }),
    /** Tidy's hint line during the player turn ("thinking", then the hint), or null. */
    hint: hintBubble(model),
    hintStatus: model.hint?.status ?? null,
    /** Changes with every hint state, so the dialogue's typewriter restarts. */
    hintKey: 30_000 + model.run * 100 + model.hintsUsed * 2 + (model.hint?.status === "shown" ? 1 : 0),
    hintsLeft: hintsLeft(model),
    canAskHint: canAskHint(model),
    askHint,
    dismissHint: () => dispatch({ type: "hint-dismiss" }),
  };
}
