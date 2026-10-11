// Server-only hint data for level act1-08. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for reset. main has two commits, oldest first: 'Build the stand' (menu.txt) and 'Add the fizz' (menu.txt with a fizz line). Nothing is pushed.",
    "The latest save was made too soon. The player must move main back to 'Build the stand' and keep the fizz line in menu.txt.",
    "Intended path: git log --oneline to see the saves, then git reset --soft HEAD~1 (git reset HEAD~1 also works: the change stays in the file, unstaged).",
    "Common mistakes: git reset --hard HEAD~1 (the fizz line is thrown away, the way back is the reflog), or git revert HEAD (adds a cancelling commit instead of taking the save back).",
    "Explain why it is safe: the save has not been pushed, so nobody else has it.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "The save has not left your machine, so nobody else has it. Is there a way to move your branch back one step and keep the work?",
    "Git can move a branch back and leave the changes in your files. There are gentler and harsher ways, and the harsh one throws the changes away.",
    "Use git reset, go back one save, and ask it to keep the changes in your files rather than throw them away.",
  ],
};
