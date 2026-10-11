// Server-only hint data for level act1-10. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Teaching level for merge conflicts. main has 'Write the sign' and 'Add the opening hours' (sign.txt gets the line 'Open 9 to 5').",
    "Tidy's branch 'slogan' has 'Add the cold drinks line' (sign.txt gets 'Cold drinks only' at the same place). Merging clashes in sign.txt.",
    "The player must merge slogan, fix sign.txt so that both lines stay and no conflict markers remain, then git add sign.txt and git commit.",
    "The conflict editor opens from the Files panel: pick both sides ('Keep both') or edit the whole file.",
    "Common mistakes: git commit before fixing the file (git refuses), keeping only one line, or adding the file with the markers still in it.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "Git stopped because you both changed the same place, and it will not guess. Where does it show you the clash?",
    "Open the file from the Files panel and choose what stays. Then tell git the file is settled and finish the merge.",
    "Once the file is fixed, use git add on it, then git commit to finish the merge.",
  ],
};
