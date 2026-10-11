import type { Level } from "@/engine/types";
import { allOf, branch, commitWithMessageReachableFrom, fileInTipEquals } from "./goals";
import { git, say, write } from "./script";

const BASE = "Build the stand";
const BAD = "Change the sign";
const GOOD = "Add the price list";

const SIGN = "LEMONADE\n";
const SIGN_TYPO = "LEMONAD\n";
const PRICES = "Lemonade: 2 coins\n";

/*
 * Verified against real git 2.46:
 *
 *   Setup (all on main, nothing pushed): BASE (sign.txt = SIGN), BAD (sign.txt = SIGN_TYPO),
 *   GOOD (prices.txt). The typo is one commit below the latest.
 *
 *   git log --oneline     GOOD, BAD, BASE
 *   git revert HEAD~1     a new commit that cancels BAD: sign.txt = SIGN again, prices.txt untouched
 *
 *   Also accepted: git revert <id of BAD>. Not accepted: git revert HEAD (cancels the price list and
 *   leaves the typo), or git reset --hard HEAD~2 (erases the price list and the history).
 */

export const level: Level = {
  id: "act1-07",
  act: 1,
  order: 7,
  title: "Take one back",
  brief: "A save two steps back put a typo on the sign. Cancel just that save with a new one, and keep everything after it.",
  mission: {
    situation:
      "Two saves ago, the sign in sign.txt was changed to LEMONAD. Since then the price list was added, which is good and must stay.",
    job: "Cancel the sign change with a new commit, without deleting any history. You will use this again in Act 2, when Blaze ships a change that Tidy has already built on.",
    practise: ["git log --oneline", "git revert"],
  },
  usedIn: "act2-04",
  crew: ["tidy"],
  setup: [
    write("player", "sign.txt", SIGN),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", BASE),
    write("player", "sign.txt", SIGN_TYPO),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", BAD),
    write("player", "prices.txt", PRICES),
    git("player", "add", "prices.txt"),
    git("player", "commit", "-m", GOOD),
  ],
  intro: [
    say("tidy", "Look at sign.txt. It says LEMONAD. That typo came in two saves ago, and I did not notice.", "thinking", ["sign.txt"]),
    say("tidy", "We added the price list on top of it since, so we cannot just go back in time. We would lose the price list.", "thinking", ["prices.txt"]),
    say("tidy", "git revert makes a new commit that cancels an older one. Nothing is deleted, and everything after it stays.", "happy"),
    say("tidy", "HEAD is the latest save. HEAD~1 is the one before it, HEAD~2 the one before that.", "talking"),
  ],
  goals: [
    {
      id: "undo-sign",
      description: "Cancel the sign change and keep the price list: git revert on the save two steps back (see git log --oneline)",
      check: allOf(
        fileInTipEquals(branch("main"), "sign.txt", SIGN),
        fileInTipEquals(branch("main"), "prices.txt", PRICES),
        commitWithMessageReachableFrom(branch("main"), BAD),
        commitWithMessageReachableFrom(branch("main"), GOOD),
      ),
    },
  ],
  suggestions: ["git status", "git log --oneline", "git show HEAD~1", "git revert HEAD~1"],
  outro: [
    say("tidy", "The sign is right again, the price list is still there, and the history still shows what happened.", "celebrate"),
    say("tidy", "That is the polite way to undo something. It matters most when other people already built on top.", "happy"),
  ],
};
