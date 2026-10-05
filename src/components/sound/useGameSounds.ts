"use client";

// One hook that turns game state changes into sounds, so wiring the game takes a single line.
// It only reads plain values, so it does not depend on the game module's internals.

import { useEffect, useRef } from "react";
import type { EngineEvent, RepoState } from "@/engine/types";
import { buildSchedule } from "@/components/map/timeline";
import { sound } from "./engine";
import type { Effect } from "./effects";
import { armUnlock } from "./useSound";

export type GameSoundInput = {
  /** Events of the latest change. A new array means "play these" (GameState.events). */
  events: readonly EngineEvent[];
  /** The state the events lead to (GameState.repo). */
  repo: RepoState;
  /** One entry per goal (GameState.goals). */
  goals: readonly boolean[];
  /** GameState.phase. */
  phase: string;
  /** Terminal lines (GameState.log). Only the player's own error lines make a sound. */
  log: readonly { id: number; kind: string; actor?: string; scripted?: boolean }[];
  reduce?: boolean;
};

export type Snapshot = { goalsDone: number; phase: string; lastLineId: number; lines: number };

/** The one-off sounds between two snapshots of the game. Pure. */
export function diffSounds(before: Snapshot, input: GameSoundInput): Effect[] {
  const out: Effect[] = [];
  // A shorter log means the level restarted and line ids started over.
  const since = input.log.length < before.lines ? -1 : before.lastLineId;
  const fresh = input.log.filter((l) => l.id > since);
  if (fresh.some((l) => l.kind === "error" && l.actor === "player" && !l.scripted)) out.push("error");
  if (input.phase === "won" && before.phase !== "won") out.push("win");
  else if (input.goals.filter(Boolean).length > before.goalsDone) out.push("goal");
  return out;
}

export function snapshot(input: GameSoundInput): Snapshot {
  return {
    goalsDone: input.goals.filter(Boolean).length,
    phase: input.phase,
    lastLineId: input.log.reduce((m, l) => Math.max(m, l.id), -1),
    lines: input.log.length,
  };
}

/** Plays the map, goal, win and error sounds for a running level. */
export function useGameSounds(input: GameSoundInput): void {
  const { events, repo, reduce = false } = input;
  const last = useRef<{ events: readonly EngineEvent[]; snap: Snapshot } | null>(null);
  useEffect(armUnlock, []);

  useEffect(() => {
    const prev = last.current;
    last.current = { events, snap: snapshot(input) };
    // The first render is the starting state, not a change.
    if (!prev) return;

    let delay = 0;
    if (events !== prev.events && events.length > 0) {
      const schedule = buildSchedule([...events], repo);
      sound.playSchedule(schedule, { reduce });
      // A goal ding waits for the map to finish, so it marks the result rather than the motion.
      delay = reduce ? 0 : Math.min(schedule.duration, 1500);
    }
    for (const effect of diffSounds(prev.snap, input)) sound.play(effect, effect === "error" ? 0 : delay);
  });
}
