// Server-only hint data for level act1-02. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for branch and switch. main has one commit ('Start the snack menu').",
    "snacks.txt is modified and not staged (a line '- bolts' was added). The player must not commit it on main.",
    "Intended path: create and switch to a new branch with any name (git switch -c <name>, or git branch + git switch),",
    "stage and commit snacks.txt there, then switch back to main. The uncommitted change follows the switch to the new branch.",
    "Goal: some branch other than main has a commit main does not have, the player is on main, and the working tree is clean.",
    "If the player commits on main by mistake, a fix is to create a branch at that commit and move main back,",
    "but steer them first toward checking which branch they are on with git status or git branch.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "The bolts don't belong on main yet. git status tells you which branch you're on and what changed.",
    "Make a branch of your own and switch to it, and your unsaved change comes along. Save it there, then go home to main.",
    "git switch -c makes a new branch and moves you onto it in one go. After you commit there, git switch takes you back to main.",
  ],
};
