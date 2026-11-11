// The documented solution for incident daily-05: the commands a player would type, in order.
// Used only by tests and server-side hint data. Never import this from app or component code.

import { git, type Solution } from "./script";

export const solution: Solution = [
  git("player", "reflog"),
  git("player", "reset", "--hard", "main@{1}"),
];
