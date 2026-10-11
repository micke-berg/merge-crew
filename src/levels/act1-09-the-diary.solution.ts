// The documented solution for level act1-09: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git 2.46. HEAD@{1} is the fizz save, the line above the move back to main. */
export const solution: Solution = [
  git("player", "reflog"),
  git("player", "branch", "fizz", "HEAD@{1}"),
];
