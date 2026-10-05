import type { Level } from "@/engine/types";
import { allOf, currentBranchIs, someBranchAheadOf, workingTreeClean } from "./goals";
import { git, say, write, type Solution } from "./script";

export const level: Level = {
  id: "act1-02",
  act: 1,
  order: 2,
  title: "Your own line",
  brief:
    "Branches let you try things without touching main. Put your snack idea on a branch of its own, then come back to main.",
  crew: ["tidy"],
  setup: [
    write("player", "snacks.txt", "Robot snacks\n"),
    git("player", "add", "snacks.txt"),
    git("player", "commit", "-m", "Start the snack menu"),
    // An unsaved idea. Switching to a new branch carries it along.
    write("player", "snacks.txt", "Robot snacks\n- bolts\n"),
  ],
  intro: [
    say("tidy", "See the main line on the map? That's main. Everyone relies on it, so we keep it calm.", "talking"),
    say("tidy", "You've added bolts to the snack menu. Bold. Let's not put that straight on main.", "thinking"),
    say("tidy", "Make a branch of your own and switch to it. Your unsaved change comes with you.", "talking"),
    say("tidy", "Commit it there, then switch back to main. Main stays untouched, your idea stays safe.", "happy"),
  ],
  goals: [
    {
      id: "branch-with-commit",
      description: "Commit the snack change on a new branch",
      check: someBranchAheadOf("main"),
    },
    {
      id: "back-on-main",
      description: "Switch back to main with a clean working tree",
      check: allOf(currentBranchIs("player", "main"), workingTreeClean("player")),
    },
  ],
  hintContext: [
    "Teaching level for branch and switch. main has one commit ('Start the snack menu').",
    "snacks.txt is modified and not staged (a line '- bolts' was added). The player must not commit it on main.",
    "Intended path: create and switch to a new branch with any name (git switch -c <name>, or git branch + git switch),",
    "stage and commit snacks.txt there, then switch back to main. The uncommitted change follows the switch to the new branch.",
    "Goal: some branch other than main has a commit main does not have, the player is on main, and the working tree is clean.",
    "If the player commits on main by mistake, a fix is to create a branch at that commit and move main back,",
    "but steer them first toward checking which branch they are on with git status or git branch.",
  ].join("\n"),
  suggestions: ["git status", "git branch", "git switch -c bolts", "git add snacks.txt", 'git commit -m "Add bolts"', "git switch main"],
  outro: [
    say("tidy", "Look, two lines on the map. Main is calm, and your idea has its own line.", "celebrate"),
    say("tidy", "The bolts are safe on their branch. Safer than with Blaze around, anyway.", "happy"),
  ],
};

/** Verified against real git 2.46. */
export const solution: Solution = [
  git("player", "switch", "-c", "bolts"),
  git("player", "add", "snacks.txt"),
  git("player", "commit", "-m", "Add bolts to the snacks"),
  git("player", "switch", "main"),
];
