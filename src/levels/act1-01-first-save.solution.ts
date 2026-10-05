// The documented solution for level act1-01: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git 2.46. */
export const solution: Solution = [
  git("player", "status"),
  git("player", "add", "list.txt"),
  git("player", "commit", "-m", "Add batteries to the list"),
];
