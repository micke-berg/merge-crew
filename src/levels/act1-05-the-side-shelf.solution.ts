// The documented solution for level act1-05: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git 2.46. */
export const solution: Solution = [
  git("player", "stash"),
  git("player", "switch", "prices"),
  git("player", "switch", "main"),
  git("player", "stash", "pop"),
];
