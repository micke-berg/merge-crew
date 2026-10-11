// Server-only hint data for level act1-12. Never import this from client code.

import "server-only";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Practice level for putting one file back to its last saved version. The player is on main with two unsaved, unstaged edits.",
    "sign.txt has a loud edit nobody wants. menu.txt has a hot chocolate line that is good and must stay.",
    "The player must put sign.txt back to its last save and keep the edit in menu.txt. The edit was never saved, so it cannot be brought back afterwards.",
    "Intended path: git diff to look, then git restore sign.txt (git checkout -- sign.txt also works).",
    "Common mistakes: restoring everything or git reset --hard (the hot chocolate is lost too), or git stash (both edits leave the files).",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "One of the files has an edit you do not want and the other has one you do. Which file should go back to how it was at the last save?",
    "Git can bring a single file back to how it was at the last save, and it leaves your other files alone. Look for that, and be careful not to touch the good edit.",
    "Use git restore with the name of the file that has the unwanted edit. Leave the other file out, so its edit stays.",
  ],
};
