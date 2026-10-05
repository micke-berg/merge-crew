// Server-only hint data for level act2-02. Never import this from client code.

import "server-only";
import { DRIFT_CLOUD, DRIFT_SLOGAN, DRIFT_LINE, PRICES, ICED_TEA, MAIN_LINE, PRICE_TEA } from "@/levels/act2-02-drifts-long-walk";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Merge conflict level. Drift's branch 'drift' started at main's first commit ('Paint the sign') and never pulled.",
    `Drift has two commits: '${DRIFT_CLOUD}' (adds cloud.txt) and '${DRIFT_SLOGAN}' (appends '${DRIFT_LINE}' to sign.txt).`,
    `Main has three newer commits, already pushed: '${PRICES}', '${ICED_TEA}' (appends '${MAIN_LINE}' to sign.txt) and '${PRICE_TEA}'.`,
    "Both sides appended a different line at the end of sign.txt, so they conflict. Nothing else overlaps.",
    "The branch 'drift' is checked out in Drift's worktree (/crew/drift), so the player cannot switch to it or rebase it in place.",
    "Intended fix: on main, git merge drift. It stops with a conflict in sign.txt.",
    "The player resolves it in the conflict editor, keeping both lines (either order is fine), then git add sign.txt and git commit",
    "(the game has no editor; a plain git commit uses the merge message), then git push.",
    "Also fine: a new branch from drift (git switch -c <name> drift), git rebase main, resolve, git add, git rebase --continue,",
    "then switch to main, merge that branch and push.",
    "Goals: both Drift commits reachable from origin's main; origin's sign.txt has both lines and no conflict markers;",
    "main's three commits are still the originals (not rebased or copied). No force-push is needed or wanted.",
    "Good first nudges: git log --oneline --all shows how far apart the lines are; git status during a conflict names the file.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Drift's branch and main both changed the end of sign.txt. Bringing them together means choosing which lines to keep.",
    "Merge Drift's branch into main. When git stops on the conflict, open sign.txt and keep both lines.",
    "When the merge stops, fix sign.txt in the editor and git add it. Then git commit and git push, no rebase needed.",
  ],
};
