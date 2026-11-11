// The documented solution for level act3-01: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git by tests/oracle/levels.test.ts. See the comment at the top of the level file. */
export const solution: Solution = [
  git("player", "log", "--oneline", "--all"),
  git("player", "show", "--stat", "blaze-sale"),
  git("player", "merge", "tidy-hours"),
  git("player", "merge", "hoarder-soup"),
  git("player", "push"),
];
