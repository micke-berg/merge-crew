// The documented, real-git-verified solution of every level, keyed by level id.
// Imported by the level and game tests, the oracle tests, and the server-only hint data
// (src/hints/data, for the answer-leak check). Never import this from app or component code that
// runs in the browser, because it would ship every answer there.

import { level as act1_01 } from "./act1-01-first-save";
import { solution as act1_01_solution } from "./act1-01-first-save.solution";
import { level as act1_02 } from "./act1-02-your-own-line";
import { solution as act1_02_solution } from "./act1-02-your-own-line.solution";
import { level as act1_03 } from "./act1-03-bringing-it-home";
import { solution as act1_03_solution } from "./act1-03-bringing-it-home.solution";
import { level as act1_04 } from "./act1-04-the-shared-copy";
import { solution as act1_04_solution } from "./act1-04-the-shared-copy.solution";
import { level as act2_01 } from "./act2-01-blaze-was-in-a-hurry";
import { solution as act2_01_solution } from "./act2-01-blaze-was-in-a-hurry.solution";
import { level as act2_02 } from "./act2-02-drifts-long-walk";
import { solution as act2_02_solution } from "./act2-02-drifts-long-walk.solution";
import { level as act2_03 } from "./act2-03-hoarders-secret-pile";
import { solution as act2_03_solution } from "./act2-03-hoarders-secret-pile.solution";
import { level as act2_04 } from "./act2-04-undo-politely";
import { solution as act2_04_solution } from "./act2-04-undo-politely.solution";
import { level as act2_05 } from "./act2-05-just-that-one-fix";
import { solution as act2_05_solution } from "./act2-05-just-that-one-fix.solution";
import type { Solution } from "./script";

export const solutions: Readonly<Record<string, Solution>> = Object.fromEntries([
  [act1_01.id, act1_01_solution],
  [act1_02.id, act1_02_solution],
  [act1_03.id, act1_03_solution],
  [act1_04.id, act1_04_solution],
  [act2_01.id, act2_01_solution],
  [act2_02.id, act2_02_solution],
  [act2_03.id, act2_03_solution],
  [act2_04.id, act2_04_solution],
  [act2_05.id, act2_05_solution],
]);
