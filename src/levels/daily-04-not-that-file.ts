import type { Level } from "@/engine/types";
import { branch, fileAbsentInTip, fileInTipEquals } from "./goals";
import { git, point, say, write } from "./script";

const OPEN = "Open the café";
const MENU = "Lemonade\nIced tea\nSoup\n";

/*
 * A daily incident: played only at /daily, never listed in the acts. Checked against real git by
 * tests/oracle/levels.test.ts.
 *
 *   Hoarder staged everything in the player's folder, including keys.txt (the till password). Nothing is committed.
 *   Expected: git restore --staged keys.txt, git commit -m "..." (only menu.txt is saved).
 *   Also accepted: git reset HEAD keys.txt, or unstaging everything and adding menu.txt again.
 *   Not accepted: committing as it is, which puts the password in the history.
 */

export const level: Level = {
  id: "daily-04",
  act: 2,
  order: 104,
  title: "Not that file",
  par: 2,
  learned: "The staging area is your last look before a commit. git restore --staged takes a file out of it and leaves the file itself alone.",
  brief: "Hoarder staged every file in your folder to be helpful. One of them is the till password. Save the soup, and only the soup.",
  mission: {
    situation: "Two files are staged for your next commit: menu.txt with the new soup, and keys.txt, which holds the till password and must never be saved in a commit.",
    job: "Take keys.txt out of the staging area and commit the menu change on its own.",
    practise: ["git status", "git diff --staged", "git restore --staged", "git commit"],
  },
  crew: ["hoarder", "tidy"],
  setup: [
    write("player", "menu.txt", "Lemonade\nIced tea\n"),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", OPEN),
    git("player", "push", "-u", "origin", "main"),
    write("player", "menu.txt", MENU),
    write("player", "keys.txt", "TILL_PASSWORD=lemon123\n"),
  ],
  intro: [
    say("hoarder", "You added soup to the menu! I staged it for you. I staged everything. Every file is precious.", "happy", ["menu.txt"]),
    git("player", "add", "menu.txt", "keys.txt"),
    say("tidy", "Everything includes keys.txt. That is the till password, Hoarder.", "scared", ["keys.txt"]),
    point("tidy", "files", "Staged means it goes into the next commit. Both files are in there now.", { mood: "thinking" }),
    say("tidy", "A password in a commit stays in the history for good. Unstage it, lead, then save the soup.", "talking"),
  ],
  goals: [
    { id: "soup-saved", description: "Save the soup in a commit on main", check: fileInTipEquals(branch("main"), "menu.txt", MENU) },
    { id: "no-password", description: "The till password stays out of every commit on main", check: fileAbsentInTip(branch("main"), "keys.txt") },
  ],
  suggestions: ["git status", "git diff --staged", "git log --oneline"],
  outro: [
    say("tidy", "Soup is saved. The password never touched the history.", "celebrate"),
    say("hoarder", "I only wanted to keep everything safe.", "guilty"),
    say("tidy", "Safe is a .gitignore line, so keys.txt can never be staged again.", "happy"),
  ],
};
