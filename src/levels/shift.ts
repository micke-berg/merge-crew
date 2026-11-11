// A shift (Act 3) turned into ordinary script steps, so the game, the tests and the real-git
// comparison all play it the same way. Pure.

import type { Level, RuleCard, ScriptStep, ShiftBeat } from "@/engine/types";

/** The cards a level is played with when the player has not chosen: the documented pick. */
export function defaultCards(level: Pick<Level, "shift">): string[] {
  return level.shift ? [...level.shift.documented] : [];
}

/** Is this beat refused by one of the chosen cards? */
export function isStopped(beat: ShiftBeat, cards: readonly string[]): boolean {
  return beat.stoppedBy !== undefined && cards.includes(beat.stoppedBy);
}

export function cardById(level: Pick<Level, "shift">, id: string): RuleCard | undefined {
  return level.shift?.cards.find((c) => c.id === id);
}

/**
 * The shift as script steps for the chosen cards. A stopped beat is the robot's line, a note in the
 * command box naming the rule, and the robot's reaction. A beat that goes through is its line, its
 * git and edit steps, and the line after it.
 */
export function shiftScript(level: Pick<Level, "shift">, cards: readonly string[]): ScriptStep[] {
  const shift = level.shift;
  if (!shift) return [];
  return shift.beats.flatMap((beat): ScriptStep[] => {
    const attempt: ScriptStep = { kind: "say", actor: beat.actor, text: beat.attempt, mood: "talking" };
    if (isStopped(beat, cards)) {
      const card = cardById(level, beat.stoppedBy ?? "");
      return [
        attempt,
        { kind: "note", text: `House rule: ${card?.title ?? beat.stoppedBy}. Refused.` },
        { kind: "say", actor: beat.actor, text: beat.stopped, mood: "guilty" },
      ];
    }
    return [
      attempt,
      ...beat.steps,
      { kind: "pause", ms: 500 },
      { kind: "say", actor: beat.after.actor, text: beat.after.text, mood: beat.after.mood ?? (beat.review ? "happy" : "scared") },
    ];
  });
}

/** The whole opening scene: the level's intro, then its shift for the chosen cards (the documented pick by default). */
export function openingOf(level: Pick<Level, "intro" | "shift">, cards: readonly string[] = defaultCards(level)): ScriptStep[] {
  return level.shift ? [...level.intro, ...shiftScript(level, cards)] : level.intro;
}

/** Every way to pick a level's cards, each as a sorted list of ids. One empty pick for a level with no shift. */
export function allPicks(level: Pick<Level, "shift">): string[][] {
  const shift = level.shift;
  if (!shift) return [[]];
  const ids = shift.cards.map((c) => c.id);
  const out: string[][] = [];
  const walk = (from: number, picked: string[]) => {
    if (picked.length === shift.pick) return void out.push([...picked].sort());
    for (let i = from; i < ids.length; i++) walk(i + 1, [...picked, ids[i]]);
  };
  walk(0, []);
  return out;
}

/** A pick as the key variant solutions are stored under. */
export const pickKey = (cards: readonly string[]) => [...cards].sort().join("+");
