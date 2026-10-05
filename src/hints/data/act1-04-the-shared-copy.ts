// Server-only hint data for level act1-04. Never import this from client code.

import "server-only";
import { START, TIDY } from "@/levels/act1-04-the-shared-copy";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for origin, push and pull. Origin is the shared copy the café's website is built from; the player's files are their own copy.",
    `main has one commit, '${START}' (hours.txt and sign.txt), pushed to origin with an upstream, so plain git push and git pull work.`,
    `Tidy works in its own worktree on branch 'tidy'. It committed '${TIDY}' (adds 'Sat: 10 to 2' to hours.txt) and, in the intro, pushed it with git push origin tidy:main.`,
    "So origin/main is one commit ahead of the player's main: git status says the branch is behind by 1, and git log --oneline --all shows origin/main above main.",
    "sign.txt in the player's working tree is modified and not staged (a line 'Now open on Saturdays!' was added). Tidy's commit does not touch sign.txt, so a pull keeps the edit.",
    "Intended path: git status, git pull (fast-forward), git add sign.txt, git commit with any message (now ahead by 1), git push.",
    "Also fine: commit first, then push. That push is rejected (non-fast-forward) because origin has a commit the player lacks.",
    "The fix is the same: git pull (it makes a merge commit, no conflicts), then git push. git pull --rebase then git push also wins.",
    "Goals: Tidy's commit is in local main; main's tip has the new sign.txt with a clean tree; origin's main has the new sign.txt and Tidy's hours,",
    "still has Tidy's original commit, and points at the same commit as local main.",
    "Never suggest --force: it would knock Tidy's commit off origin, and the goal fails. A rejected push means pull first, then push again.",
    "Good first nudges: git status to see behind or ahead; git log --oneline --all to see where origin/main is on the map.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "git status compares your copy with origin. Are you ahead, behind, or both?",
    "Origin has a commit you don't have yet. Bring it in first, then save your sign and share it.",
    "git pull brings my Saturday hours into your copy. Then add and commit sign.txt, and finish with git push.",
  ],
};
