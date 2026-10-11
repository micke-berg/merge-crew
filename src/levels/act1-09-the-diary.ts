import type { Level } from "@/engine/types";
import { allOf, noLostCommits, someBranchHasCommitMessage } from "./goals";
import { git, say, write } from "./script";

const BASE = "Build the stand";
const FIZZ = "Add the fizz drink";

const MENU = "Lemonade\nIced tea\n";
const MENU_WITH_FIZZ = "Lemonade\nIced tea\nLemon-lavender fizz\n";

/*
 * Verified against real git 2.46:
 *
 *   Setup (nothing pushed): main has BASE. The player makes a branch `fizz`, saves FIZZ on it, goes
 *   back to main and deletes the branch with git branch -D. FIZZ now has no branch pointing at it.
 *   The HEAD reflog, newest first:
 *     HEAD@{0} checkout: moving from fizz to main
 *     HEAD@{1} commit: Add the fizz drink
 *     HEAD@{2} checkout: moving from main to fizz
 *     HEAD@{3} commit (initial): Build the stand
 *
 *   git reflog                    shows those lines
 *   git branch fizz HEAD@{1}      puts a branch back on the lost commit (its id works too)
 *
 *   Also accepted: git switch -c <name> HEAD@{1}, or any other way to make FIZZ reachable by its
 *   original commit. Not accepted: git cherry-pick, which makes a copy and leaves the original lost.
 */

export const level: Level = {
  id: "act1-09",
  act: 1,
  order: 11,
  title: "The diary",
  brief: "A branch was deleted too soon and its only save is not on any branch now. Git remembers where it was.",
  mission: {
    situation:
      "Tidy made a branch for the fizz drink and saved it there, then deleted the branch to tidy up. The fizz save is not on any branch any more.",
    job: "Find the fizz save in git's private diary, the reflog, and put a branch back on it. You will use this again in Act 2, when Blaze overwrites work on the shared copy.",
    practise: ["git reflog", "git branch"],
  },
  usedIn: "act2-01",
  crew: ["tidy"],
  setup: [
    write("player", "menu.txt", MENU),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", BASE),
    git("player", "switch", "-c", "fizz"),
    write("player", "menu.txt", MENU_WITH_FIZZ),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", FIZZ),
    git("player", "switch", "main"),
    git("player", "branch", "-D", "fizz"),
  ],
  intro: [
    say("tidy", "I deleted my fizz branch to tidy up. Then I remembered the fizz drink was only saved on that branch.", "thinking"),
    say("tidy", "The save is not gone. Git keeps a private diary of everywhere your position has been, and it lives on your machine.", "happy"),
    say("tidy", "git reflog prints it, newest first. Find the line where the fizz drink was saved, then put a branch back on it with git branch.", "talking"),
  ],
  goals: [
    {
      id: "fizz-back",
      description: "Put a branch back on the fizz save: find it with git reflog, then git branch with a name and the save",
      check: allOf(someBranchHasCommitMessage(FIZZ), noLostCommits()),
    },
  ],
  suggestions: ["git status", "git log --oneline --all", "git reflog", "git branch"],
  outro: [
    say("tidy", "The fizz drink is back on a branch. The diary remembered it.", "celebrate"),
    say("tidy", "Remember the reflog. It only lives on your machine, but it is how you get back to a save when nothing points at it.", "happy"),
  ],
};
