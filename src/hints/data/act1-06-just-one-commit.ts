// Server-only hint data for level act1-06. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for cherry-pick. main has one commit, 'Build the stand' (sign.txt).",
    "Tidy's branch 'ideas' has two more commits, oldest first: 'Paint clouds on the cups' (cups.txt, unfinished) and 'Add opening hours' (sign.txt with opening hours).",
    "The branch is checked out in Tidy's own worktree. The wanted commit is the newest one on the branch.",
    "Intended fix: git cherry-pick with the branch name, which copies that branch's newest commit onto main. No conflict.",
    "The goal: the opening hours commit and the updated sign.txt are on main, and the cups commit is not on main.",
    "Steer away from git merge ideas: it brings the unfinished cups along. A branch name given to cherry-pick means its newest commit.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "A merge would bring everything on Tidy's branch, cups included. Is there a way to copy just one commit?",
    "Git can copy a single commit from another branch onto the one you are on. Which commit do you want, and which branch is it on?",
    "Use git cherry-pick and give it the name of Tidy's branch, which stands for that branch's newest commit.",
  ],
};
