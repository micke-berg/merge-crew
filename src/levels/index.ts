// The level list the game ships. Solutions live in the sibling *.solution.ts files and are
// gathered in ./solutions.ts for tests; nothing here imports them, so they stay out of the browser.

import type { Level } from "@/engine/types";
import { level as act1_01 } from "./act1-01-first-save";
import { level as act1_02 } from "./act1-02-your-own-line";
import { level as act1_03 } from "./act1-03-bringing-it-home";
import { level as act1_04 } from "./act1-04-the-shared-copy";
import { level as act1_05 } from "./act1-05-the-side-shelf";
import { level as act1_06 } from "./act1-06-just-one-commit";
import { level as act1_07 } from "./act1-07-take-one-back";
import { level as act1_08 } from "./act1-08-take-my-last-save-back";
import { level as act1_09 } from "./act1-09-the-diary";
import { level as act1_10 } from "./act1-10-two-edits-one-line";
import { level as act1_11 } from "./act1-11-look-before-you-save";
import { level as act1_12 } from "./act1-12-undo-an-edit";
import { level as act1_13 } from "./act1-13-a-straight-line";
import { level as act1_14 } from "./act1-14-who-changed-it";
import { level as act2_01 } from "./act2-01-blaze-was-in-a-hurry";
import { level as act2_02 } from "./act2-02-drifts-long-walk";
import { level as act2_03 } from "./act2-03-hoarders-secret-pile";
import { level as act2_04 } from "./act2-04-undo-politely";
import { level as act2_05 } from "./act2-05-just-that-one-fix";

/** Every level, sorted by act and then by order within the act. */
export const levels: Level[] = [act1_01, act1_02, act1_03, act1_04, act1_05, act1_06, act1_07, act1_08, act1_09, act1_10, act1_11, act1_12, act1_13, act1_14, act2_01, act2_02, act2_03, act2_04, act2_05].sort(
  (a, b) => a.act - b.act || a.order - b.order,
);

export function getLevel(id: string): Level | undefined {
  return levels.find((l) => l.id === id);
}
