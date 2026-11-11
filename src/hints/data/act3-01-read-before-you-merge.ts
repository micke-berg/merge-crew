// Server-only hint data for level act3-01. Never import this from client code.

import "server-only";
import { BANNER, FASTER, HOURS, SOUP } from "@/levels/act3-01-read-before-you-merge";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Review level. main has one commit, 'Open the café' (sign.txt, menu.txt, prices.txt), pushed to origin.",
    "Three robots each have a branch that is not in main yet and say it is ready to merge:",
    `'tidy-hours' has '${HOURS}' (a new file hours.txt). Safe.`,
    `'hoarder-soup' has '${SOUP}' (one new line in menu.txt). Safe.`,
    `'blaze-sale' has '${BANNER}' (one new line in sign.txt) and '${FASTER}', which deletes prices.txt although its message does not say so. Not safe.`,
    "The player is the lead and has to read what each branch changes before merging. Looking commands: git log --oneline --all,",
    "git show --stat <branch>, git diff main...<branch>.",
    "Intended fix: merge tidy-hours and hoarder-soup into main, leave blaze-sale out, then git push. No conflicts.",
    "Goals: both safe commits are on main and on origin's main; prices.txt is still on main and on origin's main with its content.",
    "Also fine: cherry-picking only the banner commit. If the player merged blaze-sale, prices.txt is gone from main and has to come back",
    "(a revert of the commit that deleted it).",
    "Do not tell the player which branch is the bad one in the first two hints: finding it is the level.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Three branches want in, and a commit message only tells you what its robot meant to do. What did each branch really change?",
    "Look at the files each branch touches, one branch at a time. One of them removes something the café still needs.",
    "git show can list the files a commit changed. Read each branch that way, then use git merge for the ones you trust.",
  ],
};
