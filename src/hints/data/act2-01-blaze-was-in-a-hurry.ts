// Server-only hint data for level act2-01. Never import this from client code.

import "server-only";
import { TIDY_1, TIDY_2, BLAZE } from "@/levels/act2-01-blaze-was-in-a-hurry";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Recovery level: a force-push removed commits from origin, and the local checkouts were reset to match.",
    `Before the scene: origin/main had 'Paint the sign', 'Add opening hours', then Tidy's '${TIDY_1}' and '${TIDY_2}' (prices.txt).`,
    "The player had pulled, so local main was at Tidy's second commit.",
    `Blaze's branch 'blaze' started before Tidy's work and has one commit, '${BLAZE}' (sign.txt only, no overlap with prices.txt).`,
    "In the scene Blaze ran git push --force origin blaze:main, then reset the player's main and Tidy's branch to origin/main.",
    "Now no branch, remote branch or worktree reaches Tidy's two commits. They exist only in the reflog.",
    "The player's reflog: HEAD@{0} 'reset: moving to origin/main' (Blaze's commit), HEAD@{1} 'pull: Fast-forward' (Tidy's second commit).",
    "main@{1} and HEAD@{1} both point at Tidy's second commit, whose parent is Tidy's first.",
    "Intended fix: look at git reflog, name the lost commit with a branch (git branch <name> main@{1}),",
    "merge that branch into main (a real merge, no conflicts), then git push, which fast-forwards origin without --force.",
    "Goals: both Tidy commits reachable from origin's main, Blaze's original commit still on origin's main (not rebased or copied),",
    "and no lost commits at the end (so cherry-picks alone leave the originals lost unless a branch keeps them).",
    "Steer away from force-pushing: that is the mistake this level is about, and it would push Blaze's work off origin.",
    "Good first nudges: git reflog shows where main has been; git log on a reflog entry shows what was there.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Git keeps a diary of everywhere main has been. The reflog is a good place to look for my price list.",
    "Find the reflog entry from before Blaze's reset, and give that commit a branch name so it can't get lost again.",
    "git branch can put a name on an old reflog entry, and git merge brings it into main. A normal git push finishes it, no forcing needed.",
  ],
};
