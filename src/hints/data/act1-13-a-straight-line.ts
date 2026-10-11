// Server-only hint data for level act1-13. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for rebase. main has 'Build the stand' and then 'Add opening hours'. The branch 'menu' has 'Write the menu' on top of 'Build the stand', so it is one commit behind main. The player is on menu. Nothing is pushed.",
    "The player must bring menu up to date so its history is a straight line: stand, opening hours, menu. No merge commit.",
    "Intended path: git rebase main while on the menu branch.",
    "Common mistakes: git merge main (works, but adds a merge commit, so the history is not a straight line; the way back is git reset), or being on main when running the command.",
    "Explain the difference: merge keeps history as it happened and joins it with an extra commit; rebase replays the commit on top of the newer base.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Your branch is one save behind main. Is there a way to bring it up to date without adding an extra joining save?",
    "Git can replay your branch's save on top of the newer main, so the history stays one straight line. Which branch should it replay onto?",
    "Use git rebase and name the branch you want to replay on top of.",
  ],
};
