import type { Level } from "@/engine/types";
import { anyOf, someBranchTipHasFiles, stashHasEntry, workingTreeClean } from "./goals";
import { git, mood, pause, say, write } from "./script";

const MENU = "Write the menu";
const HOURS = "Add opening hours";

const RECIPE_STASH = "fizz recipe, almost ready, do not lose";
const DOODLE_STASH = "doodles";

export const FIZZ = "Lemon-lavender fizz\n1 lemon\n2 sprigs of lavender\nFizzy water\nA secret pinch of sugar\n";
export const MENU_WITH_FIZZ = "Lemonade\nIced tea\nLemon-lavender fizz (secret!)\n";
const DOODLE_NOTES = "Ideas:\nPaint the stand blue? Or not. Or yes?\n";

/*
 * The situation, verified step by step against real git 2.46 (bare origin, linked worktrees):
 *
 *   Setup (instant):
 *     player:  MENU (menu.txt, notes.txt), git push -u origin main
 *     hoarder: worktree /crew/hoarder on branch hoarder.
 *              Writes fizz.txt (new, staged with git add) and adds a fizz line to menu.txt (unstaged),
 *              then git stash push -m RECIPE_STASH. Never committed.
 *     player:  HOURS (hours.txt), git push. Main has moved on since the stash was made.
 *
 *   Intro (scene):
 *     hoarder: edits notes.txt, git stash push -m DOODLE_STASH ("one more safe place")
 *   The stash list is now (shared by every worktree):
 *     stash@{0}: On hoarder: doodles
 *     stash@{1}: On hoarder: fizz recipe, almost ready, do not lose
 *   git stash show -p stash@{1} shows fizz.txt (new) and the menu line.
 *
 *   Expected solution:
 *     git stash list
 *     git stash show -p stash@{1}
 *     git stash branch fizz stash@{1}   new branch at the stash's base, switched to it, recipe applied,
 *                                       stash@{1} dropped. fizz.txt staged, menu.txt modified.
 *     git add menu.txt
 *     git commit -m "Save the fizz recipe"
 *   Real git result: branch fizz holds fizz.txt and the menu line; stash@{0} (doodles) is untouched;
 *   the player's worktree is clean.
 *
 *   Also accepted: git stash pop stash@{1} (or apply) on main, git add, git commit (main moved on, but
 *   nothing overlaps). Not accepted: git stash pop with no argument (that restores the doodles, not the
 *   recipe), or git stash clear / drop (the work is thrown away).
 */

export const level: Level = {
  id: "act2-03",
  act: 2,
  order: 3,
  title: "Hoarder's secret pile",
  brief:
    "Hoarder never commits. Weeks ago it tucked a secret recipe into the stash and forgot which pile it was in. Find it and save it properly in a commit.",
  crew: ["hoarder", "tidy"],
  setup: [
    write("player", "menu.txt", "Lemonade\nIced tea\n"),
    write("player", "notes.txt", "Ideas:\n"),
    git("player", "add", "menu.txt", "notes.txt"),
    git("player", "commit", "-m", MENU),
    git("player", "push", "-u", "origin", "main"),
    git("player", "worktree", "add", "/crew/hoarder", "-b", "hoarder"),
    write("hoarder", "fizz.txt", FIZZ),
    write("hoarder", "menu.txt", MENU_WITH_FIZZ),
    git("hoarder", "add", "fizz.txt"),
    git("hoarder", "stash", "push", "-m", RECIPE_STASH),
    write("player", "hours.txt", "Open 9 to 5\n"),
    git("player", "add", "hours.txt"),
    git("player", "commit", "-m", HOURS),
    git("player", "push"),
  ],
  intro: [
    say("tidy", "Hoarder, the fizz recipe. You said it was nearly done. Weeks ago.", "talking"),
    say("hoarder", "It is! It's safe. Very safe. I put it away so nothing could happen to it.", "scared"),
    say("tidy", "Away where? There's no commit.", "thinking"),
    say("hoarder", "Commits are so... permanent. What if it's wrong? I stashed it. Like a squirrel.", "guilty"),
    say("hoarder", "Oh! I have a new idea too. Let me put that somewhere safe as well.", "surprised"),
    // Hoarder's signature shuffle while it tucks one more thing on top of the pile.
    mood("hoarder", "thinking"),
    write("hoarder", "notes.txt", DOODLE_NOTES),
    git("hoarder", "stash", "push", "-m", DOODLE_STASH),
    pause(600),
    say("hoarder", "There. Now everything's on the pile. Somewhere. Lead, could you dig out the recipe?", "scared"),
  ],
  goals: [
    {
      id: "recipe-committed",
      description: "Hoarder's fizz recipe is saved in a commit on a branch (fizz.txt and the menu line)",
      check: someBranchTipHasFiles({ "fizz.txt": FIZZ, "menu.txt": MENU_WITH_FIZZ }),
    },
    {
      id: "doodles-safe",
      description: "Hoarder's doodles are not thrown away",
      check: anyOf(stashHasEntry(DOODLE_STASH), someBranchTipHasFiles({ "notes.txt": DOODLE_NOTES })),
    },
    {
      id: "clean",
      description: "Your working tree is clean",
      check: workingTreeClean("player"),
    },
  ],
  hintContext: [
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
  suggestions: [
    "git status",
    "git stash list",
    "git stash show -p stash@{0}",
    "git branch",
    "git add menu.txt",
    "git log --oneline --all",
  ],
  outro: [
    say("hoarder", "It's in a commit. A real one. It has a name and everything.", "celebrate"),
    say("tidy", "And now it can't get lost under a pile of doodles.", "happy"),
    say("hoarder", "Can I commit the doodles too? Just to be safe?", "thinking"),
    say("tidy", "One step at a time, Hoarder.", "talking"),
  ],
};
