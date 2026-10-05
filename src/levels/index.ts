import type { Level } from "@/engine/types";
import * as act1_01 from "./act1-01-first-save";
import * as act1_02 from "./act1-02-your-own-line";
import * as act1_03 from "./act1-03-bringing-it-home";
import * as act2_01 from "./act2-01-blaze-was-in-a-hurry";
import * as act2_02 from "./act2-02-drifts-long-walk";
import * as act2_03 from "./act2-03-hoarders-secret-pile";
import * as act2_04 from "./act2-04-undo-politely";
import * as act2_05 from "./act2-05-just-that-one-fix";
import type { Solution } from "./script";

const modules = [act1_01, act1_02, act1_03, act2_01, act2_02, act2_03, act2_04, act2_05];

/** Every level, sorted by act and then by order within the act. */
export const levels: Level[] = modules
  .map((m) => m.level)
  .sort((a, b) => a.act - b.act || a.order - b.order);

export function getLevel(id: string): Level | undefined {
  return levels.find((l) => l.id === id);
}

/** The documented, real-git-verified solution per level id. For tests, not for the hint helper. */
export const solutions: Readonly<Record<string, Solution>> = Object.fromEntries(
  modules.map((m) => [m.level.id, m.solution]),
);
