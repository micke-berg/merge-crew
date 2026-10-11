import type { Level } from "@/engine/types";
import { allOf, workingFileEquals } from "./goals";
import { git, say, write } from "./script";

const BASE = "Build the stand";

const MENU = "Lemonade\nIced tea\n";
/** The good edit, not saved yet. */
const MENU_WITH_COCOA = "Lemonade\nIced tea\nHot chocolate\n";
const SIGN = "LEMONADE\n";
/** The edit nobody wants, not saved either. */
const SIGN_LOUD = "LEMONADE!!! BUY NOW!!!\n";

/*
 * Verified against real git 2.46:
 *
 *   Setup: main has one commit (menu.txt and sign.txt). Both files are modified and nothing is staged:
 *   sign.txt has a loud edit (not wanted), menu.txt has the hot chocolate line (wanted).
 *
 *   git restore sign.txt   sign.txt is back to its last saved version, menu.txt keeps its edit
 *
 *   Also accepted: git checkout -- sign.txt.
 *   Not accepted: git restore . or git reset --hard (the hot chocolate line is thrown away too),
 *   git stash (both edits leave the files).
 */

export const level: Level = {
  id: "act1-12",
  act: 1,
  order: 6,
  title: "Undo an edit",
  brief: "One file has an edit nobody wants and another has a good one. Put the first file back, and keep the good edit.",
  mission: {
    situation:
      "Tidy tried a loud new sign in sign.txt and hates it. Tidy also added hot chocolate to menu.txt, which is good. Neither edit is saved.",
    job: "Put sign.txt back to its last saved version and keep the hot chocolate in menu.txt. In Act 2, Undo, politely, you will undo a change that is already saved and shared.",
    practise: ["git restore"],
  },
  usedIn: "act2-04",
  crew: ["tidy"],
  setup: [
    write("player", "menu.txt", MENU),
    write("player", "sign.txt", SIGN),
    git("player", "add", "menu.txt", "sign.txt"),
    git("player", "commit", "-m", BASE),
    // Two edits that are not saved yet: one wanted, one not.
    write("player", "sign.txt", SIGN_LOUD),
    write("player", "menu.txt", MENU_WITH_COCOA),
  ],
  intro: [
    say("tidy", "I tried a loud new sign, and it looks terrible. Now sign.txt has an edit I do not want.", "thinking", ["sign.txt"]),
    say("tidy", "I also added hot chocolate to menu.txt. That one is good, and I want to keep it.", "talking", ["menu.txt"]),
    say("tidy", "git restore puts a file back to how it was at the last save. Give it a file name and it only touches that file.", "happy"),
    say("tidy", "Be careful with anything that undoes everything at once. It would take my hot chocolate too.", "thinking"),
  ],
  goals: [
    {
      id: "sign-back",
      description: "Put sign.txt back to its last saved version and keep the hot chocolate in menu.txt: git restore, with just that file",
      check: allOf(workingFileEquals("player", "sign.txt", SIGN), workingFileEquals("player", "menu.txt", MENU_WITH_COCOA)),
    },
  ],
  suggestions: ["git status", "git diff", "git restore sign.txt"],
  outro: [
    say("tidy", "The sign is back to what it was, and the hot chocolate is still in menu.txt.", "celebrate", ["sign.txt"]),
    say("tidy", "An edit that was never saved cannot be brought back, so look with git diff first. Saved changes have gentler ways out.", "happy"),
  ],
};
