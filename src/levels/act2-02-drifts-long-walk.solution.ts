// The documented solution for level act2-02: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { DRIFT_LINE, MAIN_LINE } from "./act2-02-drifts-long-walk";
import { git, write, type Solution } from "./script";

/** The sign after a fair resolution: both new lines kept. Either order is accepted by the goals. */
const RESOLVED_SIGN = `LEMONADE\nOpen 9 to 5\n${MAIN_LINE}\n${DRIFT_LINE}\n`;

/** Verified against real git 2.46. See the comment at the top of the level file. The edit step stands in for the conflict editor. */
export const solution: Solution = [
  git("player", "merge", "drift"),
  write("player", "sign.txt", RESOLVED_SIGN),
  git("player", "add", "sign.txt"),
  git("player", "commit"),
  git("player", "push"),
];
