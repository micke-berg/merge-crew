// Server-only hint data for level act1-01. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for status, add and commit. The repository has one commit on main ('Start the shopping list').",
    "list.txt in the player's working tree is modified (a line 'batteries for Tidy' was added) and not staged.",
    "The player must stage list.txt and then commit it with any message.",
    "Intended path: look with git status, stage with git add, then git commit with a message flag. The message is free.",
    "Common mistakes: running commit before add (git says there is nothing staged), or forgetting the message flag.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Start by asking git what it sees: git status lists the files that changed. Which one is waiting to be saved?",
    "A save in git takes two moves. First you put the file on the staging area, then you commit what is staged.",
    "Use git add with the file's name, then git commit with -m and a short message in quotes.",
  ],
};
