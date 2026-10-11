// Server-only hint data for level act1-07. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for revert. main has three commits, oldest first: 'Build the stand' (sign.txt), 'Change the sign' (sign.txt with a typo, LEMONAD) and 'Add the price list' (prices.txt). Nothing is pushed.",
    "The player must cancel 'Change the sign' with a new commit, keep the price list, and keep the old commits in the history.",
    "Intended path: git log --oneline to see the commits, then git revert HEAD~1 (or the id of the sign commit). The default message is fine.",
    "Common mistakes: git revert HEAD (cancels the price list, the typo stays), or git reset --hard HEAD~2 (erases the price list and the history).",
    "Steer away from reset: it rewrites history and loses the price list. Revert adds a new commit and leaves history alone.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "You want the sign fixed but the price list kept. Is there a way to cancel one old save without touching the ones after it?",
    "Git can make a new save that is the opposite of an older one, so the history stays as it is. Which save is the one to cancel, and how far back is it from the latest?",
    "Use git revert and give it the save that is one step before the latest one.",
  ],
};
