// Server-only hint data for level act1-11. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Practice level for looking at changes and saving only some of them. The player is on main with two unsaved edits and nothing staged.",
    "sign.txt has opening hours added (wanted). menu.txt has a test line added (not wanted, it says it is only a test).",
    "The player must look at what changed, stage and commit only sign.txt, and leave the test line in menu.txt unsaved in the working files.",
    "Intended path: git diff to look, git add sign.txt, git commit -m with a message. git show is an optional way to look at the saved commit afterwards.",
    "Common mistakes: git add . or git commit -a (the test line is saved too), committing without staging anything (git refuses), or discarding the menu.txt edit with git restore.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Two files changed, and only one of those changes belongs in the next save. How could you see exactly what changed in each file?",
    "Git can show you every changed line, file by file. Once you know which change is the good one, tell git to put only that file into the next save.",
    "Look with git diff, then use git add on just the file you want saved and finish with git commit. The other file keeps its edit, unsaved.",
  ],
};
