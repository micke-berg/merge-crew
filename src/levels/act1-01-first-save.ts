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
  brief:
    "Tidy has written something on the crew's shopping list, but it is not saved yet. Save it for real with a commit.",
  crew: ["tidy"],
  setup: [
    write("player", "list.txt", LIST_BEFORE),
    git("player", "add", "list.txt"),
    git("player", "commit", "-m", "Start the shopping list"),
    // The change the player will save: an edited, unstaged file.
    write("player", "list.txt", LIST_AFTER),
  ],
  intro: [
    say("tidy", "Hello, lead! I'm Tidy. This is our repository. Everything the crew builds lives here.", "talking"),
    say("tidy", "I added a line to list.txt. Batteries. Purely for the team, of course.", "happy"),
    say("tidy", "Right now that change only exists in the file. Type git status and you'll see git noticed it.", "talking"),
    say("tidy", "Saving takes two steps. git add puts the change on the stage, git commit takes the photo.", "talking"),
  ],
  goals: [
    {
      id: "commit-list",
      description: "Commit the change to list.txt on main",
      check: allOf(
        historyAtLeast(branch("main"), 2),
        fileInTipEquals(branch("main"), "list.txt", LIST_AFTER),
      ),
    },
    {
      id: "clean",
      description: "Leave nothing unsaved: git status shows a clean working tree",
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
  suggestions: ["git status", "git add list.txt", 'git commit -m "Add batteries to the list"', "git log"],
  outro: [
    say("tidy", "Saved! That commit is a snapshot we can always come back to.", "celebrate"),
    say("tidy", "And the batteries are now on the record. Historic.", "happy"),
  ],
};
