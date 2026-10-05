import type { Level } from "@/engine/types";
import {
  allOf,
  branch,
  commitWithMessageReachableFrom,
  currentBranchIs,
  hasMergeCommit,
  workingTreeClean,
} from "./goals";
import { git, say, write, type Solution } from "./script";

export const level: Level = {
  id: "act1-03",
  act: 1,
  order: 3,
  title: "Bringing it home",
  brief: "Tidy finished two branches for the robot cafe. Merge both into main.",
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
    say("tidy", "I've been busy. Two branches: menu and colors. Both done, both tested, both mine.", "happy"),
    say("tidy", "Merge them into main, one at a time. From main, git merge <branch>.", "talking"),
    say("tidy", "The first one is easy. Main hasn't moved, so git just slides main forward. That's a fast-forward.", "talking"),
    say("tidy", "The second one is different. Main moved since that branch started, so git ties the two lines together with a merge commit.", "thinking"),
  ],
  goals: [
    {
      id: "menu-merged",
      description: "Main has Tidy's menu",
      check: commitWithMessageReachableFrom(branch("main"), "Write the menu"),
    },
    {
      id: "colors-merged",
      description: "Main has Tidy's colors, joined with a merge commit",
      check: allOf(
        commitWithMessageReachableFrom(branch("main"), "Pick the colors"),
        hasMergeCommit(branch("main")),
      ),
    },
    {
      id: "clean",
      description: "You are on main with a clean working tree",
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

/** Verified against real git 2.46 (with GIT_MERGE_AUTOEDIT=no so the merge uses its default message). */
export const solution: Solution = [
  git("player", "merge", "menu"),
  git("player", "merge", "colors"),
];
