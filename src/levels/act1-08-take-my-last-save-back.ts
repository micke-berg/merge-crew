import type { Level } from "@/engine/types";
import { allOf, branchPointsAt, workingFileEquals } from "./goals";
import { git, say, write } from "./script";

const BASE = "Build the stand";
const TOO_SOON = "Add the fizz";

const MENU = "Lemonade\nIced tea\n";
const MENU_WITH_FIZZ = "Lemonade\nIced tea\nLemon-lavender fizz\n";

/*
 * Verified against real git 2.46:
 *
 *   Setup (main, nothing pushed): BASE (menu.txt = MENU), then TOO_SOON (menu.txt = MENU_WITH_FIZZ).
 *   The working files are clean.
 *
 *   git log --oneline         TOO_SOON, BASE
 *   git reset --soft HEAD~1   main moves back to BASE, the fizz line stays in menu.txt and is staged
 *
 *   Also accepted: git reset HEAD~1 (the fizz line stays in menu.txt, not staged), or --mixed.
 *   Not accepted: git reset --hard HEAD~1 (the fizz line is gone), git revert HEAD (adds a commit
 *   instead of taking the save back).
 */

export const level: Level = {
  id: "act1-08",
  act: 1,
  order: 10,
  title: "Take my last save back",
  brief: "You saved too soon. Take the save back, but keep the change in your files so you can finish it.",
  mission: {
    situation:
      "Tidy saved the fizz drink in menu.txt, then realised it is not ready. Nothing has been pushed, so nobody else has this save.",
    job: "Move main back one save and keep the fizz line in menu.txt, so Tidy can finish it before saving again. In Act 2 you will see why this is only safe for saves nobody else has.",
    practise: ["git log --oneline", "git reset"],
  },
  usedIn: "act2-04",
  crew: ["tidy"],
  setup: [
    write("player", "menu.txt", MENU),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", BASE),
    write("player", "menu.txt", MENU_WITH_FIZZ),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", TOO_SOON),
  ],
  intro: [
    say("tidy", "I saved the fizz drink, and then I saw the spelling. It is not ready, and I want to fix it before it is a save.", "thinking", ["menu.txt"]),
    say("tidy", "Nothing is pushed, so this save is only on our machine. That makes it safe to take back.", "talking"),
    say("tidy", "git reset moves your branch back to an earlier save. It can keep your changes in the files, or throw them away.", "happy"),
    say("tidy", "Be careful with the harsh version, it throws them away. We want to keep the fizz line.", "thinking"),
  ],
  goals: [
    {
      id: "save-taken-back",
      description: "Take the last save back and keep the fizz line in menu.txt: git reset, one save back, keeping the changes",
      check: allOf(branchPointsAt("main", BASE), workingFileEquals("player", "menu.txt", MENU_WITH_FIZZ)),
    },
  ],
  suggestions: ["git status", "git log --oneline", "git reset --soft HEAD~1", "git reset --hard HEAD~1"],
  outro: [
    say("tidy", "The save is gone from the history and the fizz line is still in menu.txt. Now I can finish it.", "celebrate"),
    say("tidy", "Remember the difference: reset takes a save away, revert adds a new one that cancels it. Reset is only for saves nobody else has.", "happy"),
  ],
};
