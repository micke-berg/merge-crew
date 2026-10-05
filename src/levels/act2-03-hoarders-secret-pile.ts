import type { Level } from "@/engine/types";
import { anyOf, someBranchTipHasFiles, stashHasEntry, workingTreeClean } from "./goals";
import { git, mood, pause, say, write } from "./script";

export const MENU = "Write the menu";
export const HOURS = "Add opening hours";

export const RECIPE_STASH = "fizz recipe, almost ready, do not lose";
export const DOODLE_STASH = "doodles";

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
  mission: {
    situation:
      "Hoarder never commits. Weeks ago it hid a new drink recipe for the café in the stash, git's drawer for unsaved work, and it just put more on top.",
    job: "Find the fizz recipe in the stash and save it in a commit on a branch, without throwing away Hoarder's other stash.",
    practise: ["git stash list", "git stash show -p", "git stash branch", "git commit"],
  },
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
    say("tidy", "Hoarder, the fizz drink for the café menu, menu.txt. You said the recipe was nearly done. Weeks ago.", "talking", ["menu.txt"]),
    say("hoarder", "It is! I put it in the stash, git's drawer for unsaved work. Commits are so... permanent.", "guilty"),
    say("hoarder", "Oh! A new idea. Let me put that in the drawer too. On top. For safety.", "surprised"),
    // Hoarder's signature shuffle while it tucks one more thing on top of the pile.
    mood("hoarder", "thinking"),
    write("hoarder", "notes.txt", DOODLE_NOTES),
    git("hoarder", "stash", "push", "-m", DOODLE_STASH),
    pause(600),
    say("hoarder", "There. Now it's all in the pile. Somewhere. Lead, could you dig out the recipe and save it properly?", "scared"),
  ],
  goals: [
    {
      id: "recipe-committed",
      description: "Save Hoarder's fizz recipe (fizz.txt and its menu line) in a commit on a branch",
      check: someBranchTipHasFiles({ "fizz.txt": FIZZ, "menu.txt": MENU_WITH_FIZZ }),
    },
    {
      id: "doodles-safe",
      description: "Hoarder's other stash, the doodles, is not thrown away",
      check: anyOf(stashHasEntry(DOODLE_STASH), someBranchTipHasFiles({ "notes.txt": DOODLE_NOTES })),
    },
    {
      id: "clean",
      description: "Leave nothing unsaved in your files",
      check: workingTreeClean("player"),
    },
  ],
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
