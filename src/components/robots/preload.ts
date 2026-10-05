// Which sheets a level needs, so they can be fetched before the scene asks for them. Pure.

import type { Level, ScriptStep } from "@/engine/types";
import { isSpriteRobot, moodState } from "./moods";
import type { SheetSize, SpriteRobot, SpriteState } from "./sheets.generated";

export type SheetRef = { size: SheetSize; robot: SpriteRobot; state: SpriteState };

/** Map: idle, travel and every scripted mood. Portraits: idle and every mood a robot speaks with. */
export function levelSheets(level: Pick<Level, "crew" | "intro" | "outro">): SheetRef[] {
  const seen = new Set<string>();
  const out: SheetRef[] = [];
  const add = (size: SheetSize, robot: SpriteRobot, state: SpriteState) => {
    const k = `${size}/${robot}/${state}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ size, robot, state });
  };
  const crew = level.crew.filter(isSpriteRobot);
  for (const r of crew) for (const s of ["idle", "move", "hop"] as const) add("map", r, s);
  const steps: ScriptStep[] = [...level.intro, ...level.outro];
  for (const step of steps) {
    if (step.kind !== "say" && step.kind !== "mood") continue;
    if (!isSpriteRobot(step.actor)) continue;
    const state = moodState(step.actor, step.mood ?? "talking");
    add("map", step.actor, state);
    if (step.kind === "say") add("portrait", step.actor, state);
  }
  // The win panel: everyone celebrates.
  for (const r of crew) {
    add("portrait", r, moodState(r, "celebrate"));
    add("portrait", r, "happy");
  }
  return out;
}
