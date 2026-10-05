// The documented solution for level act1-03: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git 2.46 (with GIT_MERGE_AUTOEDIT=no so the merge uses its default message). */
export const solution: Solution = [
  git("player", "merge", "menu"),
  git("player", "merge", "colors"),
];
