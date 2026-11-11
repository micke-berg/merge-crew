// Server-only hint data for incident daily-06. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Amend incident. origin's main has 'Open the caf\u00e9'. The player's main has one more commit, not pushed, with the message 'asdf'.",
    "It adds hours.txt (the winter hours). The change is right; only the message is useless.",
    "Intended fix: git commit --amend -m with a real message. That replaces the newest commit with a new one (the old one is left behind).",
    "Wrong turn: making another commit on top, which keeps 'asdf' in the history. Goal needs exactly one commit on top of origin's main.",
    "Goals: main's tip has a message of at least five characters that is not 'asdf', its parent is origin's main, and hours.txt is in it;",
    "origin's main is unchanged.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "The change in that commit is fine. Only its message is wrong, and nobody else has the commit yet.",
    "You do not need a second commit. The newest commit itself can be replaced by a corrected copy while it is unpushed.",
    "git commit has a way to redo the newest commit in place of adding another. Give it a message that says what was changed.",
  ],
};
