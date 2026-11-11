import type { Level } from "@/engine/types";
import { someBranchHasCommitMessage } from "./goals";
import { git, point, say, write } from "./script";

const OPEN = "Open the café";
const MENU = "Add the menu";
export const CUPS = "Order new cups";

/*
 * A daily incident: played only at /daily, never listed in the acts. Checked against real git by
 * tests/oracle/levels.test.ts.
 *
 *   Drift checked out an old commit in the player's folder (a detached HEAD) and new work was committed there.
 *   Expected: git switch -c cups (a branch on the new commit, and HEAD on it).
 *   Also accepted: git branch cups (the commit is on a branch; HEAD may stay detached).
 */

export const level: Level = {
  id: "daily-02",
  act: 2,
  order: 102,
  title: "No branch at all",
  par: 1,
  learned: "On a detached HEAD a new commit belongs to no branch. Give it one before you switch away, or only the reflog remembers it.",
  brief: "Drift wandered your folder back to an old commit, and then you saved new work there. That commit is on no branch. Give it one.",
  mission: {
    situation: "Your HEAD is detached: you are standing on an old commit, not on a branch. The cups order you just saved hangs off it, with no branch to hold it.",
    job: "Put the new commit on a branch, so it cannot get lost when you go back to main.",
    practise: ["git status", "git log --oneline --all", "git switch -c"],
  },
  crew: ["drift", "tidy"],
  setup: [
    write("player", "sign.txt", "CAFÉ COG\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", OPEN),
    write("player", "menu.txt", "Lemonade\nIced tea\n"),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", MENU),
    git("player", "push", "-u", "origin", "main"),
  ],
  intro: [
    say("drift", "I wanted to see how the café looked on its first day. So I took your folder back there. It was nice.", "happy"),
    git("player", "switch", "--detach", "HEAD~1"),
    say("tidy", "And then the cups order got saved. Right there, on that old commit.", "surprised"),
    write("player", "cups.txt", "40 cups, with lids\n"),
    git("player", "add", "cups.txt"),
    git("player", "commit", "-m", CUPS),
    point("tidy", "map", "This commit is on no branch. Only you are standing on it. Walk away and nothing points at it.", {
      mood: "thinking",
      focus: { commits: [CUPS] },
    }),
    say("tidy", "Give it a branch before you go anywhere, lead.", "talking"),
  ],
  goals: [
    {
      id: "on-a-branch",
      description: "Put the cups commit on a branch",
      check: someBranchHasCommitMessage(CUPS),
    },
  ],
  suggestions: ["git status", "git log --oneline --all", "git branch", "git switch main"],
  outro: [
    say("tidy", "The cups order has a branch. Now it is safe to go back to main.", "celebrate"),
    say("drift", "A commit with no branch. It sounded peaceful to me.", "happy"),
    say("tidy", "It is peaceful right up until git cleans it away.", "talking"),
  ],
};
