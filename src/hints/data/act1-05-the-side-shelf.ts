// Server-only hint data for level act1-05. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for the stash. The player is on main with an unsaved, unstaged edit to menu.txt (a fizz drink line).",
    "A branch called prices has a commit that also changes menu.txt, so git refuses to switch to it while the edit is there.",
    "The player must put the edit on the stash, visit prices, come back to main and take the edit off the stash again.",
    "Intended path: git stash, git switch prices, git switch main, git stash pop. The edit must be back in menu.txt and the stash empty.",
    "Common mistakes: trying to switch with the edit still in place (git refuses), committing the unfinished edit, or dropping or clearing the stash so the edit is lost.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Git refused to move because your unfinished edit would be overwritten. Is there a way to put work aside without saving it as a commit?",
    "Git has a shelf for work you are not ready to save. Put the edit there and your files go back to the last save, so you can move freely and take it off again when you are back.",
    "Use git stash to put the edit aside, switch to the other branch and back, then bring the edit back with the pop subcommand of git stash.",
  ],
};
