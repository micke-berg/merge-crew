// Tiny builders so level files read like a script. Pure data out, no logic.

import type { ActorId, Mood, Path, RobotId, ScreenTarget, ScriptStep } from "@/engine/types";

/** A git command run by an actor. `git("player", "commit", "-m", "Add login")`. */
export const git = (actor: ActorId, ...args: string[]): ScriptStep => ({
  kind: "git",
  actor,
  argv: ["git", ...args],
});

/** Write a file in an actor's working files (not a git command). */
export const write = (actor: ActorId, path: Path, content: string): ScriptStep => ({
  kind: "edit",
  edit: { kind: "write", actor, path, content },
});

/** A robot line. `files` are working files the line mentions; the files panel highlights them. */
export const say = (actor: RobotId, text: string, mood?: Mood, files?: Path[]): ScriptStep => ({
  kind: "say",
  actor,
  text,
  ...(mood ? { mood } : {}),
  ...(files?.length ? { files } : {}),
});

/**
 * A guided-tour line: the robot explains one part of the screen while the game highlights it.
 * `focus` narrows a map highlight to commits (by message), branch lines (by name) or the lost band.
 */
export const point = (
  actor: RobotId,
  target: ScreenTarget,
  text: string,
  options: { mood?: Mood; focus?: { commits?: string[]; branches?: string[]; lost?: boolean } } = {},
): ScriptStep => ({
  kind: "point",
  actor,
  target,
  text,
  ...(options.mood ? { mood: options.mood } : {}),
  ...(options.focus ? { focus: options.focus } : {}),
});

export const mood = (actor: RobotId, m: Mood): ScriptStep => ({ kind: "mood", actor, mood: m });

export const pause = (ms: number): ScriptStep => ({ kind: "pause", ms });

/** A level file's documented solution: the commands a player would type, in order. */
export type Solution = ScriptStep[];
