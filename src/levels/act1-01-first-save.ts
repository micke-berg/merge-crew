import type { Level } from "@/engine/types";
import {
  allOf,
  branch,
  fileInTipEquals,
  historyAtLeast,
  workingTreeClean,
} from "./goals";
import { git, say, write } from "./script";

const LIST_BEFORE = "milk\n";
const LIST_AFTER = "milk\nbatteries for Tidy\n";

export const level: Level = {
  id: "act1-01",
  act: 1,
  order: 1,
  title: "First save",
  brief: "Tidy changed the café's shopping list, but the change is not saved yet. Save it with a commit.",
  mission: {
    situation: "Tidy added batteries to the café's shopping list, list.txt, but git has not saved that change yet.",
    job: "Save Tidy's change in a commit, so the crew can always come back to this version.",
    practise: ["git status", "git add", "git commit"],
  },
  crew: ["tidy"],
  setup: [
    write("player", "list.txt", LIST_BEFORE),
    git("player", "add", "list.txt"),
    git("player", "commit", "-m", "Start the shopping list"),
    // The change the player will save: an edited, unstaged file.
    write("player", "list.txt", LIST_AFTER),
  ],
  intro: [
    say("tidy", "Hi, lead! I'm Tidy. This project holds Café Cog's files, like list.txt. Git keeps every version we save.", "talking", ["list.txt"]),
    say("tidy", "I added a line to our shopping list, list.txt. Batteries. Purely for the café, of course.", "happy", ["list.txt"]),
    say("tidy", "The file has changed, but git hasn't saved it yet. A save in git is called a commit.", "talking", ["list.txt"]),
    say("tidy", 'Save it in two steps: git add list.txt, then git commit -m "Add batteries".', "talking", ["list.txt"]),
  ],
  goals: [
    {
      id: "commit-list",
      description: 'Save list.txt: git add list.txt, then git commit -m "Add batteries"',
      check: allOf(
        historyAtLeast(branch("main"), 2),
        fileInTipEquals(branch("main"), "list.txt", LIST_AFTER),
      ),
    },
    {
      id: "clean",
      description: "Leave nothing unsaved: git status says the working tree is clean",
      check: workingTreeClean("player"),
    },
  ],
  hintContext: [
    "Teaching level for status, add and commit. The repository has one commit on main ('Start the shopping list').",
    "list.txt in the player's working tree is modified (a line 'batteries for Tidy' was added) and not staged.",
    "The player must stage list.txt and then commit it with any message.",
    "Intended path: look with git status, stage with git add, then git commit with a message flag. The message is free.",
    "Common mistakes: running commit before add (git says there is nothing staged), or forgetting the message flag.",
  ].join("\n"),
  suggestions: ["git status", "git add list.txt", 'git commit -m "Add batteries"', "git log"],
  outro: [
    say("tidy", "Saved! That commit is a snapshot we can always come back to.", "celebrate"),
    say("tidy", "And the batteries are now on the record. Historic.", "happy"),
  ],
};
