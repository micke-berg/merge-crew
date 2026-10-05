// The documented solution for level act2-04: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git 2.46 (GIT_EDITOR=true, so revert keeps its default message). See the comment at the top of the level file. */
export const solution: Solution = [
  git("player", "pull"),
  git("player", "log", "--oneline"),
  git("player", "revert", "HEAD~1"),
  git("player", "push"),
];
