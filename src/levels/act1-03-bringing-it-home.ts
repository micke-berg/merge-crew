import type { Level } from "@/engine/types";
import {
  allOf,
  branch,
  commitWithMessageReachableFrom,
  currentBranchIs,
  hasMergeCommit,
  workingTreeClean,
} from "./goals";
import { git, say, write } from "./script";

export const level: Level = {
  id: "act1-03",
  act: 1,
  order: 3,
  title: "Bringing it home",
  brief: "Tidy finished two branches for the café. Merge both into main.",
  mission: {
    situation: "Tidy finished two things for the café, each on its own branch: the menu and the wall colors.",
    job: "Bring both branches into main, so the café gets the menu and the colors.",
    practise: ["git merge", "git log --oneline --all"],
  },
  crew: ["tidy"],
  setup: [
    write("player", "cafe.txt", "Robot Cafe\n"),
    git("player", "add", "cafe.txt"),
    git("player", "commit", "-m", "Open the robot cafe"),
    // Tidy works in its own worktree. Both branches start from the same commit on main.
    git("player", "worktree", "add", "/crew/tidy", "-b", "menu"),
    write("tidy", "menu.txt", "Oil latte\n"),
    git("tidy", "add", "menu.txt"),
    git("tidy", "commit", "-m", "Write the menu"),
    git("tidy", "switch", "-c", "colors", "main"),
    write("tidy", "colors.txt", "walls: teal\n"),
    git("tidy", "add", "colors.txt"),
    git("tidy", "commit", "-m", "Pick the colors"),
  ],
  intro: [
    say("tidy", "I've been busy. See the two new lines on the map? Branches menu and colors. Both done, both mine.", "happy"),
    say("tidy", "Merging brings a branch's work into main. You're on main, so start with git merge menu.", "talking"),
    say("tidy", "Main hasn't moved since that branch started, so git just slides main forward. That's a fast-forward.", "talking"),
    say("tidy", "Then git merge colors. Main has moved by then, so git ties the two lines together with a merge commit.", "thinking"),
  ],
  goals: [
    {
      id: "menu-merged",
      description: "Bring in the menu: git merge menu",
      check: commitWithMessageReachableFrom(branch("main"), "Write the menu"),
    },
    {
      id: "colors-merged",
      description: "Bring in the colors: git merge colors (git makes a merge commit)",
      check: allOf(
        commitWithMessageReachableFrom(branch("main"), "Pick the colors"),
        hasMergeCommit(branch("main")),
      ),
    },
    {
      id: "clean",
      description: "Stay on main with nothing unsaved",
      check: allOf(currentBranchIs("player", "main"), workingTreeClean("player")),
    },
  ],
  hintContext: [
    "Teaching level for merge. main has one commit ('Open the robot cafe').",
    "Tidy made two branches from that commit: 'menu' (commit 'Write the menu', adds menu.txt) and",
    "'colors' (commit 'Pick the colors', adds colors.txt). Tidy's worktree has 'colors' checked out. The files do not overlap, so no conflicts.",
    "Intended path: the player stays on main and runs git merge menu (fast-forward), then git merge colors (a real merge commit).",
    "Either order works: whichever branch is merged second needs a merge commit.",
    "Goal: both commits reachable from main, a merge commit on main, the player on main with a clean tree.",
    "The game's merge uses git's default merge message, so no editor or -m flag is needed.",
  ].join("\n"),
  suggestions: ["git status", "git branch", "git log --oneline --all", "git merge menu", "git merge colors"],
  outro: [
    say("tidy", "Both lines came home. The stop with two lines going into it is your merge commit.", "celebrate"),
    say("tidy", "That's Act 1. You can save, branch and merge. I'm a little proud. Don't tell Blaze.", "happy"),
  ],
};
