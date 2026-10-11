import type { Level } from "@/engine/types";
import { allOf, branch, fileInTipEquals, workingFileEquals } from "./goals";
import { git, say, write } from "./script";

const BASE = "Build the stand";

const MENU = "Lemonade\nIced tea\n";
/** The edit nobody wants saved: a test line. */
const MENU_WITH_TEST = "Lemonade\nIced tea\nTEST LINE (just testing, delete me)\n";
const SIGN = "LEMONADE\n";
const SIGN_WITH_HOURS = "LEMONADE\nOpen 9 to 5\n";

/*
 * Verified against real git 2.46:
 *
 *   Setup: main has one commit (menu.txt and sign.txt). Both files are modified and nothing is staged:
 *   sign.txt has the opening hours (wanted), menu.txt has a test line (not wanted).
 *
 *   git diff                            shows both changes, file by file
 *   git add sign.txt                    only the sign goes into the next save
 *   git commit -m "Add opening hours"   saves sign.txt, menu.txt keeps its unsaved test line
 *
 *   Not accepted: git add . or git commit -am (the test line is saved too), or git restore menu.txt
 *   (the test line is thrown away instead of being left unsaved).
 */

export const level: Level = {
  id: "act1-11",
  act: 1,
  order: 5,
  title: "Look before you save",
  brief: "Two files are changed and only one change is wanted. Look at what changed, then save just that file.",
  mission: {
    situation:
      "Tidy changed two files today. The opening hours in sign.txt are good, and the test line in menu.txt was only an experiment.",
    job: "Look at what changed, save only sign.txt, and leave the test line in menu.txt unsaved. In Act 2, Undo, politely, you will look at what a save changed before you undo it.",
    practise: ["git diff", "git add", "git commit"],
  },
  usedIn: "act2-04",
  crew: ["tidy"],
  setup: [
    write("player", "menu.txt", MENU),
    write("player", "sign.txt", SIGN),
    git("player", "add", "menu.txt", "sign.txt"),
    git("player", "commit", "-m", BASE),
    // Two edits that are not saved yet: one wanted, one not.
    write("player", "sign.txt", SIGN_WITH_HOURS),
    write("player", "menu.txt", MENU_WITH_TEST),
  ],
  intro: [
    say("tidy", "I changed two files today, menu.txt and sign.txt. One change is good and one was only a test.", "talking", ["menu.txt", "sign.txt"]),
    say("tidy", "I do not remember which is which. Before you save anything, look. git diff shows every line that changed.", "thinking"),
    say("tidy", "Then save only the good one. git add chooses what goes into the next save, and git commit makes the save.", "happy"),
    say("tidy", "The other change stays in your files, unsaved. That is fine, and it is what we want.", "talking"),
  ],
  goals: [
    {
      id: "only-the-good-edit",
      description:
        "Save just the opening hours: git diff to look, then git add and git commit for that one file. The test line in menu.txt stays unsaved",
      check: allOf(
        fileInTipEquals(branch("main"), "sign.txt", SIGN_WITH_HOURS),
        fileInTipEquals(branch("main"), "menu.txt", MENU),
        workingFileEquals("player", "menu.txt", MENU_WITH_TEST),
      ),
    },
  ],
  suggestions: ["git status", "git diff", "git add sign.txt", 'git commit -m "Add opening hours"', "git show"],
  outro: [
    say("tidy", "The opening hours are saved, and the test line is still in menu.txt, not saved.", "celebrate", ["menu.txt"]),
    say("tidy", "You can use git show to see what a saved commit changed, and git diff for what is not saved yet.", "happy"),
  ],
};
