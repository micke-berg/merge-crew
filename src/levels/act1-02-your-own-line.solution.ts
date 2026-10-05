// The documented solution for level act1-02: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git 2.46. */
export const solution: Solution = [
  git("player", "switch", "-c", "bolts"),
  git("player", "add", "snacks.txt"),
  git("player", "commit", "-m", "Add bolts to the snacks"),
  git("player", "switch", "main"),
];
