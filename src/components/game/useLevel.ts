"use client";

// React driver for game.ts: owns the timers that play scenes step by step.

import { useEffect, useReducer } from "react";
import { useReducedMotion } from "motion/react";
import type { Level } from "@/engine/types";
import { buildSchedule } from "@/components/map/timeline";
import { advance, begin, runPlayerCommand, skipScript, startLevel, type GameState, type Wait } from "./game";
import { markLevelComplete } from "./progress";

type Model = {
  game: GameState;
  wait: Wait;
  /** Bumped on restart so the map remounts instead of animating back. */
  run: number;
};

type Action =
  | { type: "begin" }
  | { type: "step" }
  | { type: "continue" }
  | { type: "skip" }
  | { type: "command"; line: string }
  | { type: "restart"; level: Level };

const NONE: Wait = { kind: "none" };

function init(level: Level): Model {
  return { game: startLevel(level), wait: NONE, run: 0 };
}

function reducer(m: Model, a: Action): Model {
  switch (a.type) {
    case "begin":
      return m.game.phase === "brief" ? { ...m, game: begin(m.game), wait: NONE } : m;
    case "step": {
      if (m.wait.kind === "click") return m;
      const { state, wait } = advance(m.game);
      return { ...m, game: state, wait };
    }
    case "continue": {
      if (m.wait.kind !== "click") return m;
      const { state, wait } = advance(m.game);
      return { ...m, game: state, wait };
    }
    case "skip": {
      const game = skipScript(m.game);
      return game === m.game ? m : { ...m, game, wait: NONE };
    }
    case "command": {
      const out = runPlayerCommand(m.game, a.line);
      if (out.state === m.game) return m;
      // A winning command plays out on the map before the closing scene starts.
      const wait: Wait = out.won && out.changed ? { kind: "animate", events: out.state.events } : NONE;
      return { ...m, game: out.state, wait };
    }
    case "restart":
      return { ...init(a.level), run: m.run + 1 };
  }
}

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
  const [model, dispatch] = useReducer(reducer, level, init);
  const reduce = useReducedMotion() ?? false;
  const { game, wait } = model;
  const inScene = game.phase === "intro" || game.phase === "outro";

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

  return {
    game,
    run: model.run,
    /** True while a robot line is on screen and waits for the player to read it. */
    awaitingClick: inScene && wait.kind === "click",
    begin: () => dispatch({ type: "begin" }),
    next: () => dispatch({ type: "continue" }),
    skip: () => dispatch({ type: "skip" }),
    command: (line: string) => dispatch({ type: "command", line }),
    restart: () => dispatch({ type: "restart", level }),
  };
}
