// Server-only hint data for level act1-09. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for the reflog. main has one commit, 'Build the stand'. A branch 'fizz' with the commit 'Add the fizz drink' was made and then deleted, so that commit is on no branch.",
    "The commit is still there and the reflog remembers it: git reflog shows the player's own past positions, newest first.",
    "The player must put a branch back on the fizz commit. Nothing may be left lost.",
    "Intended path: git reflog to find the line 'commit: Add the fizz drink', then git branch fizz HEAD@{1} (or the id from that line).",
    "Common mistakes: git log --oneline --all (the commit is on no branch, so it is not listed), or git cherry-pick of the id (makes a copy and leaves the original lost).",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "The branch is gone, but git remembers where you have been. Is there a list of your own past positions?",
    "Git keeps a private diary of every place your position has been. Look through it for the save with the fizz drink, then put a branch back on it.",
    "Use git reflog to find the save, then git branch with a name and that save to make a branch there.",
  ],
};
