// Server-only hint data for incident daily-01. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Wrong-branch incident. main has 'Open the caf\u00e9' (pushed) and one commit on top, 'Add a sale banner', made by mistake on main. Not pushed.",
    "No other branch exists. The player is on main.",
    "Intended fix: git branch sale (a new branch at the banner commit), then git reset --hard HEAD~1 so main is back at origin's main.",
    "Order matters: resetting first leaves the banner commit on no branch (it is then only in the reflog).",
    "Goals: main points at the same commit as origin's main; some other branch is ahead of main; no commit is lost.",
    "Also fine: git switch -c sale and then moving main back.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "The commit itself is fine. It is only standing on the wrong branch, and nothing has been pushed yet.",
    "Give the commit a second name first, so it stays safe. Only then move main back to where origin's main is.",
    "git branch can put a new branch on the commit you are on. After that, git reset moves main back one step.",
  ],
};
