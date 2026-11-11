// Server-only hint data for incident daily-03. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Diverged-with-origin incident. origin's main: 'Open the caf\u00e9', then Tidy's 'Add the price list'.",
    "The player's main: 'Open the caf\u00e9', then their own unpushed 'Add winter hours'. The two have diverged by one commit each.",
    "The caf\u00e9 wants a straight history on main: no merge commit.",
    "Intended fix: git pull --rebase (replays the player's commit on top of origin's), then git push. No conflict: different files.",
    "Also fine: git fetch, git rebase origin/main, git push.",
    "Wrong turn: a plain git pull makes a merge commit. If that happened and it is not pushed, git reset --hard HEAD~1 undoes it.",
    "Goals: origin's main has both commits; origin's main has no merge commit.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Your copy and origin each have one commit the other lacks. Joining them the usual way would tie a knot in the line.",
    "Your commit is not pushed yet, so it may still move. It can be replayed on top of the commit origin already has.",
    "git pull has a way to replay your own commits on top of what it fetched, in place of merging. Then git push goes through.",
  ],
};
