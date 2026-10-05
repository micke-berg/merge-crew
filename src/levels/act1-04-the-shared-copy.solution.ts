// The documented solution for level act1-04: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git 2.46. See the comment at the top of the level file. */
export const solution: Solution = [
  git("player", "status"),
  git("player", "pull"),
  git("player", "add", "sign.txt"),
  git("player", "commit", "-m", "Announce Saturdays on the sign"),
  git("player", "push"),
];
