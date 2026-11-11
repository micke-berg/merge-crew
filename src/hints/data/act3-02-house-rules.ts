// Server-only hint data for level act3-02. Never import this from client code.

import "server-only";
import { EVERYTHING, LOUD, WIP } from "@/levels/act3-02-house-rules";
import type { LevelHints } from "./types";

export const hints: LevelHints = {
  /** What the hint model may know: the problem and the intended fix. Never shown to the player directly. */
  context: [
    "Rule card level. Before the level the player picked two of three house rules, and each rule stopped one robot's mistake.",
    "Exactly one mistake got through, and it is on origin's main now. The player's own main is one or more commits behind origin,",
    "so the first step is always to get origin's state (git pull). Which mistake it was shows in the recent commands and the status:",
    `1. Blaze force-pushed '${LOUD}' over origin's main, which cut 'Add the price list' out of origin. The player's main still has it.`,
    "   Fix: git pull (this merges the two histories, a merge commit), then git push.",
    `2. Drift pushed '${WIP}', which added an unfinished note line to menu.txt. Fix: git pull, git revert HEAD, git push.`,
    `3. Hoarder pushed '${EVERYTHING}', which added keys.txt (the till password) and notes.txt.`,
    "   Fix: git pull, git rm keys.txt, git commit, git push. notes.txt may stay.",
    "Goals: origin's main has the price list commit, menu.txt without the note line, and no keys.txt.",
    "Rule to keep: nothing is forced, so the robot's commit stays in origin's history. Never suggest a forced push or a reset of pushed commits.",
    "Good first nudge: the player's copy does not know yet what happened on origin.",
  ].join("\n"),
  /** Used when the model is off, fails, or its hint is rejected. Gentle first, then more specific. */
  scripted: [
    "One mistake got past your rules, and it happened on origin. Your own copy has not heard about it yet.",
    "Bring origin's newest commit into your copy and read what it changed. Then undo exactly that with a new commit, so nothing is forced.",
    "git pull brings it in. After that, a new commit that takes the mistake back is all you need before you push.",
  ],
};
