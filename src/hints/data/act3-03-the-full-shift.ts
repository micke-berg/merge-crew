// Server-only hint data for level act3-03. Never import this from client code.

import "server-only";
import { EVERYTHING, HOURS, LOUD, TIDY_UP } from "@/levels/act3-03-the-full-shift";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Last level. The player picked two of three house rules, and each rule stopped one robot's mistake. Two jobs are left, in any order.",
    `Job A, a review: Tidy's branch 'tidy-hours' has one honest commit, '${HOURS}' (a new file hours.txt). It is safe.`,
    "  Read it (git diff main...tidy-hours or git show --stat tidy-hours), merge it into main and push.",
    "Job B, a fix: exactly one mistake got through and is on origin's main. The player's main is behind origin, so git pull comes first.",
    `  1. Blaze force-pushed '${LOUD}' over origin's main and cut 'Add the price list' out of origin. Fix: git pull merges it back.`,
    `  2. Drift pushed unread work; its commit '${TIDY_UP}' deleted prices.txt. Fix: git pull, then git revert HEAD.`,
    `  3. Hoarder pushed '${EVERYTHING}' with keys.txt, the till password. Fix: git pull, git rm keys.txt, git commit.`,
    "Then one git push sends both jobs to origin.",
    "Goals: origin's main has the price list commit, prices.txt with its full content, no keys.txt, and the winter hours commit.",
    "Rule to keep: nothing is forced, the crew's commits stay in origin's history. Never suggest a forced push or resetting pushed commits.",
    "Which mistake it was shows in the recent commands and status. If the first goal is met, only Tidy's branch is left to merge and push.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "You have two jobs: something went wrong on origin, and a finished branch is waiting to be read. Start with the one that is live.",
    "Bring origin's newest commit into your copy and look at what it changed. Undo exactly that with a new commit, then turn to the waiting branch.",
    "git pull brings origin's state in. Once the mistake is taken back with a new commit, git merge brings the reviewed branch in before you push.",
  ],
};
