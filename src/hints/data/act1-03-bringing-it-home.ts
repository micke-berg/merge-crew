// Server-only hint data for level act1-03. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for merge. main has one commit ('Open the robot cafe').",
    "Tidy made two branches from that commit: 'menu' (commit 'Write the menu', adds menu.txt) and",
    "'colors' (commit 'Pick the colors', adds colors.txt). Tidy's worktree has 'colors' checked out. The files do not overlap, so no conflicts.",
    "Intended path: the player stays on main and runs git merge menu (fast-forward), then git merge colors (a real merge commit).",
    "Either order works: whichever branch is merged second needs a merge commit.",
    "Goal: both commits reachable from main, a merge commit on main, the player on main with a clean tree.",
    "The game's merge uses git's default merge message, so no editor or -m flag is needed.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Two branches hold my work. git log --oneline --all shows where they sit next to main.",
    "Stay on main and bring each branch in, one at a time.",
    "git merge with a branch name brings that branch into the one you're on. Do it once for each of my branches.",
  ],
};
