import type { Level } from "@/engine/types";
import { allOf, currentBranchIs, someBranchAheadOf, workingTreeClean } from "./goals";
import { git, point, say, write } from "./script";

export const level: Level = {
  id: "act1-02",
  act: 1,
  order: 2,
  title: "Your own line",
  brief:
    "Branches let you try things without touching main. Put your snack idea on a branch of its own, then come back to main.",
  mission: {
    situation:
      "You added bolts to the café's snack menu, snacks.txt. It's an experiment, so it should not go straight onto main, the version the café's website uses.",
    job: "Save the bolts on a branch of their own, then switch back to main.",
    practise: ["git switch -c", "git add", "git commit", "git switch"],
  },
  crew: ["tidy"],
  setup: [
    write("player", "snacks.txt", "Robot snacks\n"),
    git("player", "add", "snacks.txt"),
    git("player", "commit", "-m", "Start the snack menu"),
    // An unsaved idea. Switching to a new branch carries it along.
    write("player", "snacks.txt", "Robot snacks\n- bolts\n"),
  ],
  intro: [
    point("tidy", "map", "See this line? That's main, the version the café's website uses. We keep it calm.", {
      focus: { branches: ["main"] },
    }),
    say("tidy", "You've added bolts to the snack menu, snacks.txt. Bold. Let's not put that on main yet.", "thinking", ["snacks.txt"]),
    say("tidy", "A branch is your own line to try things on. Unsaved changes come along when you switch to it.", "talking"),
    say("tidy", "Save the bolts on a new branch: git switch -c bolts, then git add snacks.txt and git commit.", "talking", ["snacks.txt"]),
    say("tidy", "Then go back with git switch main. Main stays untouched, your idea stays safe.", "happy"),
  ],
  goals: [
    {
      id: "branch-with-commit",
      description: "Save the bolts on a new branch: git switch -c bolts, then git add snacks.txt and git commit",
      check: someBranchAheadOf("main"),
    },
    {
      id: "back-on-main",
      description: "Go back to main with nothing unsaved: git switch main",
      check: allOf(currentBranchIs("player", "main"), workingTreeClean("player")),
    },
  ],
  suggestions: ["git status", "git branch", "git switch -c bolts", "git add snacks.txt", 'git commit -m "Add bolts"', "git switch main"],
  outro: [
    // The player names the branch; "bolts" is what the job bar suggests. If it is called something
    // else, the map highlights every branch line instead (see HistoryMap's focus).
    point("tidy", "map", "A branch is a line that splits off main. Main stayed calm, and your idea has its own line.", {
      mood: "celebrate",
      focus: { branches: ["bolts"] },
    }),
    say("tidy", "The bolts are safe on their branch. Safer than with Blaze around, anyway.", "happy"),
  ],
};
