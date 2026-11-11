// The documented solutions for level act3-03: one per pick of two rule cards, since the pick decides
// which mistake gets through. Used only by tests and server-side hint data. Never import this from
// app or component code: it would ship the answers to the browser.

import { NO_FORCE, NO_SECRETS, REVIEW_FIRST } from "./act3-03-the-full-shift";
import { git, type Solution } from "./script";
import { pickKey } from "./shift";

const review = [git("player", "diff", "main...tidy-hours"), git("player", "merge", "tidy-hours"), git("player", "push")];

/** Hoarder's password got through: remove the file with a new commit, then the review. */
const password: Solution = [
  git("player", "pull"),
  git("player", "show", "--stat", "HEAD"),
  git("player", "rm", "keys.txt"),
  git("player", "commit", "-m", "Remove the till password"),
  ...review,
];

/** Drift's unread work got through: undo the commit that deleted the price list, then the review. */
const deleted: Solution = [git("player", "pull"), git("player", "show", "--stat", "HEAD"), git("player", "revert", "HEAD"), ...review];

/** Blaze's forced push got through: pulling merges the price list back in, then the review. */
const forced: Solution = [git("player", "pull"), ...review];

/** The solution for the level's documented pick (no force-push, nothing unread). */
export const solution: Solution = password;

/** Every pick and what it leaves the player to do. */
export const variants: Readonly<Record<string, Solution>> = {
  [pickKey([NO_FORCE, REVIEW_FIRST])]: password,
  [pickKey([NO_FORCE, NO_SECRETS])]: deleted,
  [pickKey([REVIEW_FIRST, NO_SECRETS])]: forced,
};
