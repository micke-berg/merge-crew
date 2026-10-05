// Tiny builders so level files read like a script. Pure data out, no logic.

import type { ActorId, Mood, Path, RobotId, ScriptStep } from "@/engine/types";

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

export const say = (actor: RobotId, text: string, mood?: Mood): ScriptStep =>
  mood ? { kind: "say", actor, text, mood } : { kind: "say", actor, text };

export const mood = (actor: RobotId, m: Mood): ScriptStep => ({ kind: "mood", actor, mood: m });

export const pause = (ms: number): ScriptStep => ({ kind: "pause", ms });

/** A level file's documented solution: the commands a player would type, in order. */
export type Solution = ScriptStep[];
