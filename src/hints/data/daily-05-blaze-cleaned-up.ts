// Server-only hint data for incident daily-05. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Local reset incident. origin's main has one commit, 'Open the caf\u00e9'. The player made two more on main, 'Add winter hours' and",
    "'Add soup to the menu', and had not pushed them. Then git reset --hard origin/main was run in the player's folder.",
    "main now points at 'Open the caf\u00e9'. The two commits are on no branch, only in the reflog: main@{1} is where main was.",
    "Intended fix: git reflog to see it, then git reset --hard main@{1} (or HEAD@{1}). git merge main@{1} also works as a fast-forward.",
    "Goal: both commits are reachable from main again and nothing is lost.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "The two commits were not deleted. Main was only moved away from them, and git remembers where it stood before.",
    "Look in git's diary of where main has been. The entry just before the reset is the commit you want main back on.",
    "git reflog lists where main has been. Then git reset can move main back to the entry from before Blaze's clean-up.",
  ],
};
