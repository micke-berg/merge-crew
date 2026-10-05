// Server-only hint data for level act2-04. Never import this from client code.

import "server-only";
import { BLAZE, TIDY } from "@/levels/act2-04-undo-politely";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Revert level. origin/main was 'Paint the sign', 'Add the price list' (prices.txt: 2 coins and 3 coins).",
    `In the scene Blaze committed '${BLAZE}' (prices.txt says FREE) and pushed it to origin main (a normal fast-forward push).`,
    `Then Tidy pulled and pushed '${TIDY}' (tipjar.txt) on top. origin/main: ... -> '${BLAZE}' -> '${TIDY}'.`,
    "The player's local main is still at 'Add the price list', two commits behind origin.",
    "The point: the bad commit is shared and someone built on it, so the fix must add a commit, not rewrite history.",
    "Intended fix: git pull (fast-forward), git revert HEAD~1 (or git revert with Blaze's commit id from git log), then git push.",
    "git revert makes a new commit that undoes the change; the game has no editor, so it commits with git's default message.",
    "Editing prices.txt back by hand and committing also passes the goals.",
    "Goals: origin's prices.txt is back to coins; Blaze's original commit and Tidy's commit are still on origin's main.",
    "Steer away from git reset plus git push --force: that removes Blaze's and Tidy's commits from origin.",
    "Good first nudges: git pull to see what everyone else sees; git log --oneline to find the bad commit; git show to check it.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "First catch up with what everyone else sees. git pull, then git log --oneline to spot Blaze's commit.",
    "Blaze's commit is shared and I built on top of it, so undo it with a new commit instead of rewriting history.",
    "git revert makes a new commit that undoes an old one. Point it at Blaze's commit, then git push.",
  ],
};
