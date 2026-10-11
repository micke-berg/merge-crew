// The documented solution for level act1-14: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git 2.46 (GIT_EDITOR=true, so revert keeps its default message). HEAD~1 is Blaze's save. */
export const solution: Solution = [
  git("player", "blame", "prices.txt"),
  git("player", "revert", "HEAD~1"),
];
