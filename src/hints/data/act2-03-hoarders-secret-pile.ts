// Server-only hint data for level act2-03. Never import this from client code.

import "server-only";
import { MENU, RECIPE_STASH, HOURS, DOODLE_STASH } from "@/levels/act2-03-hoarders-secret-pile";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Stash level. Hoarder never commits. The stash is shared by every worktree, so the player sees Hoarder's stashes.",
    `Weeks ago, on branch 'hoarder' (at main's first commit '${MENU}'), Hoarder wrote fizz.txt (new file, staged)`,
    `and added 'Lemon-lavender fizz (secret!)' to menu.txt (unstaged), then ran git stash push -m "${RECIPE_STASH}".`,
    `Main has moved on since: '${HOURS}' (hours.txt). Nothing overlaps with the recipe.`,
    `In the scene Hoarder stashed a second, unrelated change (notes.txt) as "${DOODLE_STASH}".`,
    `So the list is stash@{0} '${DOODLE_STASH}' and stash@{1} '${RECIPE_STASH}'. A plain git stash pop restores the wrong one.`,
    "Intended fix: git stash list, git stash show -p stash@{1} to check, then git stash branch <name> stash@{1}",
    "(creates a branch at the stash's base, applies it and drops it), git add menu.txt, git commit -m \"...\".",
    "Also fine: git stash pop stash@{1} (or apply) on main, then add and commit.",
    "Goals: some branch tip has fizz.txt and the fizz menu line; the doodles stash still exists (or was committed);",
    "the player's working tree is clean. git stash clear or drop would throw work away.",
    "Good first nudges: the stash is a list, newest first; git stash show -p can look inside an entry before restoring it.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Hoarder's stash is a list, newest first. git stash list shows what's in the pile.",
    "The fizz recipe isn't the newest stash. Look inside each entry with git stash show -p before you restore anything.",
    "git stash branch can turn one stash entry into a new branch of its own. Then add and commit what it brings back.",
  ],
};
