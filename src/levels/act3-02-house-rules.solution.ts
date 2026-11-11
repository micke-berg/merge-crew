// The documented solutions for level act3-02: one per pick of two rule cards, since the pick decides
// which mistake gets through. Used only by tests and server-side hint data. Never import this from
// app or component code: it would ship the answers to the browser.

import { NO_FORCE, NO_SECRETS, REVIEW_FIRST } from "./act3-02-house-rules";
import { git, type Solution } from "./script";
import { pickKey } from "./shift";

/** Hoarder's password got through: remove the file with a new commit. */
const password: Solution = [
  git("player", "pull"),
  git("player", "show", "--stat", "HEAD"),
  git("player", "rm", "keys.txt"),
  git("player", "commit", "-m", "Remove the till password"),
  git("player", "push"),
];

/** Drift's notes got through: undo that commit with a new one. */
const notes: Solution = [git("player", "pull"), git("player", "log", "--oneline"), git("player", "revert", "HEAD"), git("player", "push")];

/** Blaze's forced push got through: pulling merges the price list back in. */
const forced: Solution = [git("player", "pull"), git("player", "push")];

/** The solution for the level's documented pick (no force-push, nothing unread). */
export const solution: Solution = password;

/** Every pick and the fix for the beat it lets through. */
export const variants: Readonly<Record<string, Solution>> = {
  [pickKey([NO_FORCE, REVIEW_FIRST])]: password,
  [pickKey([NO_FORCE, NO_SECRETS])]: notes,
  [pickKey([REVIEW_FIRST, NO_SECRETS])]: forced,
};
