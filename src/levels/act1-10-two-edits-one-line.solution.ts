// The documented solution for level act1-10: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, write, type Solution } from "./script";

/** Both lines kept. Either order is accepted by the goals. Verified against real git 2.46. The edit step stands in for the conflict editor. */
const RESOLVED_SIGN = "LEMONADE\nOpen 9 to 5\nCold drinks only\n";

export const solution: Solution = [
  git("player", "merge", "slogan"),
  write("player", "sign.txt", RESOLVED_SIGN),
  git("player", "add", "sign.txt"),
  git("player", "commit"),
];
