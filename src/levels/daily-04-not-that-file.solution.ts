// The documented solution for incident daily-04: the commands a player would type, in order.
// Used only by tests and server-side hint data. Never import this from app or component code.

import { git, type Solution } from "./script";

export const solution: Solution = [
  git("player", "restore", "--staged", "keys.txt"),
  git("player", "commit", "-m", "Add soup to the menu"),
];
