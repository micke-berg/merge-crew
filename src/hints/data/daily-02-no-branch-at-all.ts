// Server-only hint data for incident daily-02. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Detached HEAD incident. main has 'Open the caf\u00e9' and 'Add the menu', both pushed.",
    "The player's HEAD is detached at 'Open the caf\u00e9', and a new commit 'Order new cups' (cups.txt) was made there. It is on no branch.",
    "Intended fix: git switch -c cups, which makes a branch at the current commit and moves onto it. git branch cups also meets the goal.",
    "Danger to steer away from: git switch main before the commit has a branch. Then nothing points at it and only the reflog can find it.",
    "Goal: some local branch has the 'Order new cups' commit in its history.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Look at where you are standing: it is a commit, and no branch is attached to it. The new work hangs off that spot.",
    "Before you go back to main, the new commit needs a name of its own. Make one right where you are.",
    "git switch can make a new branch at the commit you are on and move you onto it in one step.",
  ],
};
