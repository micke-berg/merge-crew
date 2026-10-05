// The level list the game ships. Solutions live in the sibling *.solution.ts files and are
// gathered in ./solutions.ts for tests; nothing here imports them, so they stay out of the browser.

import type { Level } from "@/engine/types";
import { level as act1_01 } from "./act1-01-first-save";
import { level as act1_02 } from "./act1-02-your-own-line";
import { level as act1_03 } from "./act1-03-bringing-it-home";
import { level as act2_01 } from "./act2-01-blaze-was-in-a-hurry";
import { level as act2_02 } from "./act2-02-drifts-long-walk";
import { level as act2_03 } from "./act2-03-hoarders-secret-pile";
import { level as act2_04 } from "./act2-04-undo-politely";
import { level as act2_05 } from "./act2-05-just-that-one-fix";

/** Every level, sorted by act and then by order within the act. */
export const levels: Level[] = [act1_01, act1_02, act1_03, act2_01, act2_02, act2_03, act2_04, act2_05].sort(
  (a, b) => a.act - b.act || a.order - b.order,
);

export function getLevel(id: string): Level | undefined {
  return levels.find((l) => l.id === id);
}
