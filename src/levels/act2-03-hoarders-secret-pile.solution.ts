// The documented solution for level act2-03: the commands a player would type, in order.
// Used only by tests. Never import this from app or component code: it would ship the answer to the browser.

import { git, type Solution } from "./script";

/** Verified against real git 2.46. See the comment at the top of the level file. */
export const solution: Solution = [
  git("player", "stash", "list"),
  git("player", "stash", "show", "-p", "stash@{1}"),
  git("player", "stash", "branch", "fizz", "stash@{1}"),
  git("player", "add", "menu.txt"),
  git("player", "commit", "-m", "Save the fizz recipe"),
];
