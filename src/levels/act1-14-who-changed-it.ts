import type { Level } from "@/engine/types";
import { allOf, branch, commitWithMessageReachableFrom, fileInTipEquals } from "./goals";
import { git, say, write } from "./script";

const BASE = "Start the price list";
const TIDY = "Add the iced tea price";
const BLAZE = "Round the lemonade price";
const DRIFT = "Add the cloud cup price";

const START = "Lemonade: 2 coins\n";
const WITH_TEA = "Lemonade: 2 coins\nIced tea: 3 coins\n";
const WITH_FREE = "Lemonade: 0 coins\nIced tea: 3 coins\n";
const WITH_CLOUD = "Lemonade: 0 coins\nIced tea: 3 coins\nCloud cup: 4 coins\n";
const GOOD = "Lemonade: 2 coins\nIced tea: 3 coins\nCloud cup: 4 coins\n";

/*
 * Verified against real git 2.46:
 *
 *   Setup (all on main, nothing pushed, in a straight line): BASE (player), TIDY (tidy), BLAZE (blaze),
 *   DRIFT (drift). Each robot makes its save in its own worktree on a branch made from the latest main,
 *   and the player fast-forwards main to it, so every line keeps its real author.
 *
 *   git blame prices.txt   line 1 is BLAZE's ("0 coins"), line 2 is TIDY's, line 3 is DRIFT's
 *   git revert HEAD~1      cancels BLAZE's save (HEAD is DRIFT's), the other two lines stay
 *
 *   Also accepted: git revert <id of BLAZE's save>. Not accepted: git revert HEAD (cancels the cloud cup
 *   price and leaves the free lemonade), or git reset --hard HEAD~2 (erases the cloud cup price and the
 *   history).
 */

export const level: Level = {
  id: "act1-14",
  act: 1,
  order: 14,
  title: "Who changed this line?",
  brief: "A price became free and three robots have saved into the same file. Find out which save did it, and undo only that one.",
  mission: {
    situation:
      "The price list in prices.txt says the lemonade costs 0 coins. Tidy, Blaze and Drift have all saved changes into that file since.",
    job: "Use git blame to see which save changed the lemonade line, then undo just that save and keep everyone else's work. You will do the same in Act 2, when Blaze ships a change that others have built on.",
    practise: ["git blame", "git revert"],
  },
  usedIn: "act2-04",
  crew: ["tidy", "blaze", "drift"],
  setup: [
    write("player", "prices.txt", START),
    git("player", "add", "prices.txt"),
    git("player", "commit", "-m", BASE),
    // Each robot saves in its own worktree from the latest main, then main is moved up to its save.
    git("player", "worktree", "add", "/crew/tidy", "-b", "tidy"),
    write("tidy", "prices.txt", WITH_TEA),
    git("tidy", "add", "prices.txt"),
    git("tidy", "commit", "-m", TIDY),
    git("player", "merge", "tidy"),
    git("player", "worktree", "add", "/crew/blaze", "-b", "blaze"),
    write("blaze", "prices.txt", WITH_FREE),
    git("blaze", "add", "prices.txt"),
    git("blaze", "commit", "-m", BLAZE),
    git("player", "merge", "blaze"),
    git("player", "worktree", "add", "/crew/drift", "-b", "drift"),
    write("drift", "prices.txt", WITH_CLOUD),
    git("drift", "add", "prices.txt"),
    git("drift", "commit", "-m", DRIFT),
    git("player", "merge", "drift"),
  ],
  intro: [
    say("tidy", "Look at prices.txt. The lemonade costs 0 coins. Somebody changed that line.", "thinking", ["prices.txt"]),
    say("tidy", "Three of us have saved into this file, so I cannot just undo the latest save. We would lose someone else's work.", "talking"),
    say("tidy", "git blame prints the file with, for every line, the save and the robot that last changed it. The id on the left names the save.", "happy"),
    say("tidy", "Then cancel just that save with git revert, so the other lines stay.", "talking"),
  ],
  goals: [
    {
      id: "free-lemonade-undone",
      description: "Find the save that made the lemonade free with git blame, and undo just that one with git revert",
      check: allOf(
        fileInTipEquals(branch("main"), "prices.txt", GOOD),
        commitWithMessageReachableFrom(branch("main"), BLAZE),
        commitWithMessageReachableFrom(branch("main"), TIDY),
        commitWithMessageReachableFrom(branch("main"), DRIFT),
      ),
    },
  ],
  suggestions: ["git status", "git log --oneline", "git blame prices.txt", "git show HEAD~1"],
  outro: [
    say("tidy", "The lemonade is 2 coins again, and the iced tea and the cloud cup are still there.", "celebrate"),
    say("tidy", "Blame tells you who and which save. It is for finding the right thing to undo, not for pointing fingers.", "happy"),
  ],
};
