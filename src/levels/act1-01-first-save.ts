import type { Level } from "@/engine/types";
import {
  allOf,
  branch,
  fileInTipEquals,
  historyAtLeast,
  workingTreeClean,
} from "./goals";
import { git, point, say, write } from "./script";

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
    say("tidy", "Hi, lead! I'm Tidy. A quick look around first.", "happy"),
    // The screen tour. The "?" button in the level header replays these point steps from any level.
    point("tidy", "map", "This is the café's history. Every dot is a saved version, a commit.", {
      focus: { commits: ["Start the shopping list"] },
    }),
    point("tidy", "map", "This is main, the version the website is built from. Every new save makes its line longer.", { focus: { branches: ["main"] } }),
    point("tidy", "files", "These are the café's files as they are right now."),
    point("tidy", "jobbar", "Your job right now is always written here."),
    point("tidy", "terminal", "Type git commands here. The buttons fill in a command; Enter runs it."),
    say("tidy", "Now, I added batteries to our shopping list, list.txt. Purely for the café. Git hasn't saved that yet.", "happy", ["list.txt"]),
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
