import type { Level } from "@/engine/types";
import { branchIsStraightLine, currentBranchIs, allOf } from "./goals";
import { git, say, write } from "./script";

const BASE = "Build the stand";
const HOURS = "Add opening hours";
const MENU = "Write the menu";

/*
 * Verified against real git 2.46:
 *
 *   Setup (nothing pushed): main has BASE. Branch `menu` has MENU (menu.txt) on top of BASE. main then
 *   gets HOURS (sign.txt), so `menu` is one commit behind. The player is on `menu`.
 *
 *   git log --oneline --all   main: HOURS, BASE; menu: MENU, BASE
 *   git rebase main           MENU is replayed on top of HOURS: menu is BASE, HOURS, MENU, a straight line
 *
 *   Not accepted: git merge main (adds a merge commit, so the history is not a straight line).
 */

export const level: Level = {
  id: "act1-13",
  act: 1,
  order: 13,
  title: "A straight line",
  brief: "Your branch is behind main. Bring it up to date so the history stays one straight line.",
  mission: {
    situation:
      "Tidy's menu branch was made before main got the opening hours, so it is one save behind. You are on the menu branch.",
    job: "Bring the menu branch up to date by replaying its save on top of main, so the history is one straight line with no merge commit. You will see this again in Act 2, when Drift's branch is far behind.",
    practise: ["git rebase"],
  },
  usedIn: "act2-02",
  crew: ["tidy"],
  setup: [
    write("player", "sign.txt", "LEMONADE\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", BASE),
    git("player", "switch", "-c", "menu"),
    write("player", "menu.txt", "Lemonade\nIced tea\n"),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", MENU),
    git("player", "switch", "main"),
    write("player", "sign.txt", "LEMONADE\nOpen 9 to 5\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", HOURS),
    git("player", "switch", "menu"),
  ],
  intro: [
    say("tidy", "I built the menu on this branch. While I did, main got the opening hours, so my branch is one save behind.", "thinking"),
    say("tidy", "You could merge main into it. That works, but it adds an extra save just for the joining, and the history gets a knot.", "talking"),
    say("tidy", "git rebase replays my save on top of main, as if I had started from the latest. The history stays one straight line.", "happy"),
    say("tidy", "Rebase makes new saves, so only do it on a branch nobody else has yet.", "talking"),
  ],
  goals: [
    {
      id: "straight-line",
      description: "Bring the menu branch up to date as a straight line: git rebase main (a merge would add an extra commit)",
      check: allOf(currentBranchIs("player", "menu"), branchIsStraightLine("menu", [MENU, HOURS, BASE])),
    },
  ],
  suggestions: ["git status", "git log --oneline --all", "git rebase main", "git merge main"],
  outro: [
    say("tidy", "Now the history is one straight line: the stand, the hours, then my menu.", "celebrate"),
    say("tidy", "Merge keeps the history as it happened. Rebase tidies it up. Both are fine, as long as you do not rebase what others already have.", "happy"),
  ],
};
