// Server-only hint data for level act2-05. Never import this from client code.

import "server-only";
import { CLOUDS, FIX, POEM } from "@/levels/act2-05-just-that-one-fix";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Cherry-pick level. main: 'Build the stand' (sign.txt, table.txt with a short leg), then 'Add the price list' and 'Add opening hours'. All pushed.",
    `Drift's branch 'drift' started at 'Build the stand' and has three commits, oldest first: '${CLOUDS}' (cups.txt),`,
    `'${FIX}' (table.txt: 4 long legs) and '${POEM}' (poem.txt). It was never merged or pushed.`,
    "The branch is checked out in Drift's worktree. The fix is drift~1, the middle commit.",
    "Intended fix: git log --oneline drift to find the fix, git cherry-pick drift~1 (or its id), then git push. No conflicts.",
    "Goals: origin's main has the fix and the fixed table.txt; neither the clouds commit nor the poem commit is on origin's main;",
    "branch drift still points at the poem commit.",
    "Steer away from git merge drift: it brings the unfinished cups and the poem along.",
    "Good first nudges: git log on another branch lists its commits; git show <commit> shows what one commit changed.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Drift's branch has three commits, and only one of them is the table fix. git log --oneline drift lists them.",
    "Don't merge the whole branch. Copy just the fix onto main.",
    "git cherry-pick copies a single commit onto the branch you're on. Pick the table fix, then git push.",
  ],
};
