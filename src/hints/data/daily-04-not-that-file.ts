// Server-only hint data for incident daily-04. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Staging incident. main has one pushed commit. In the player's folder menu.txt is changed (a soup line added) and keys.txt is new.",
    "keys.txt holds the till password. Both files are staged (git add was run on both). Nothing is committed yet.",
    "Intended fix: git restore --staged keys.txt takes it out of the staging area (the file stays on disk), then git commit -m with a message.",
    "Also fine: git reset HEAD keys.txt.",
    "Wrong turn: committing with keys.txt staged. Then the password is in a commit. Not pushed, so git reset --soft HEAD~1 takes the commit back.",
    "Goals: main's tip has menu.txt with the soup line; main's tip has no keys.txt.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Look at what is about to go into your next commit. One of those two files should never be saved.",
    "The staging area can be changed before you commit. Take the password file out of it, and leave the menu in.",
    "git restore can take a file out of the staging area without touching the file. Then git commit saves what is left.",
  ],
};
