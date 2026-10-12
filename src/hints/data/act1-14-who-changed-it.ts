// Server-only hint data for level act1-14. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for blame. main has four commits in a straight line: 'Start the price list', 'Add the iced tea price' (tidy), 'Round the lemonade price' (blaze, makes the lemonade 0 coins) and 'Add the cloud cup price' (drift). Nothing is pushed.",
    "The player must undo only Blaze's save so the lemonade is 2 coins again, while the iced tea and cloud cup prices stay, and no history is erased.",
    "Intended path: git blame prices.txt to see which save changed the lemonade line, then git revert HEAD~1 (or the id blame showed).",
    "Common mistakes: git revert HEAD (cancels the cloud cup price, the free lemonade stays), or git reset --hard HEAD~2 (erases the cloud cup price and the history).",
    "Explain: blame names, for each line, the save that last changed it; revert cancels one save and leaves the others.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Several saves touched this file. Is there a way to see, line by line, which save changed each one?",
    "Git can show who last changed each line of a file and in which save. Find the lemonade line, note its save, then cancel just that save.",
    "Use git blame on the file to find the save, then git revert with that save's id.",
  ],
};
