import type { Level } from "@/engine/types";
import { fileInTipEquals, originalCommitReachableFrom, remoteBranch, allOf } from "./goals";
import { git, mood, pause, say, write } from "./script";

const SIGN = "Paint the sign";
const PRICES = "Add the price list";
export const BLAZE = "Make everything FREE";
export const TIDY = "Add a tip jar";

const GOOD_PRICES = "Lemonade: 2 coins\nIced tea: 3 coins\n";

/*
 * The situation, verified step by step against real git 2.46 (bare origin, linked worktrees):
 *
 *   Setup (instant):
 *     player:  SIGN, PRICES (prices.txt = GOOD_PRICES), git push -u origin main
 *     worktrees /crew/blaze (branch blaze) and /crew/tidy (branch tidy), both at PRICES
 *
 *   Intro (scene):
 *     blaze:   BLAZE (prices.txt "FREE"), git push origin blaze:main     (fast-forward, not forced)
 *     tidy:    git pull origin main (fast-forward), TIDY (tipjar.txt), git push origin tidy:main
 *   origin/main: SIGN - PRICES - BLAZE - TIDY. The broken commit is shared and someone has built on it,
 *   so rewriting main would pull the floor out from under Tidy.
 *
 *   Expected solution:
 *     git pull               fast-forward the player's main to TIDY
 *     git revert HEAD~1      new commit 'Revert "Make everything FREE"', prices.txt back to GOOD_PRICES
 *     git push               fast-forward on origin, no --force
 *   Real git result on origin: SIGN - PRICES - BLAZE - TIDY - Revert "Make everything FREE".
 *
 *   Also accepted: git revert <oid of BLAZE>, or editing prices.txt back by hand and committing.
 *   Not accepted: git reset --hard HEAD~2 then git push --force (BLAZE and TIDY drop off origin).
 */

export const level: Level = {
  id: "act2-04",
  act: 2,
  order: 4,
  title: "Undo, politely",
  brief:
    "Blaze shipped a change to main that makes everything free, and Tidy has already built on top of it. Undo Blaze's change without rewriting the history everyone shares.",
  mission: {
    situation:
      "Blaze changed the café's price list to make everything free and pushed it to origin. Tidy has already added a tip jar on top.",
    job: "Undo Blaze's price change with a new commit, keep Tidy's tip jar, and push the fix to origin.",
    practise: ["git pull", "git log --oneline", "git revert", "git push"],
  },
  crew: ["blaze", "tidy"],
  setup: [
    write("player", "sign.txt", "LEMONADE\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", SIGN),
    write("player", "prices.txt", GOOD_PRICES),
    git("player", "add", "prices.txt"),
    git("player", "commit", "-m", PRICES),
    git("player", "push", "-u", "origin", "main"),
    git("player", "worktree", "add", "/crew/blaze", "-b", "blaze"),
    git("player", "worktree", "add", "/crew/tidy", "-b", "tidy"),
  ],
  intro: [
    say("blaze", "Big idea. Huge. Customers love free things. So the price list, prices.txt, now says FREE.", "happy", ["prices.txt"]),
    write("blaze", "prices.txt", "Lemonade: FREE\nIced tea: FREE\n"),
    git("blaze", "add", "prices.txt"),
    git("blaze", "commit", "-m", BLAZE),
    // Blaze's wheelie on the way to main.
    mood("blaze", "celebrate"),
    pause(700),
    git("blaze", "push", "origin", "blaze:main"),
    say("tidy", "Blaze pushed without force this time. Good. I'll add our tip jar on top.", "talking"),
    git("tidy", "pull", "origin", "main"),
    write("tidy", "tipjar.txt", "Tips welcome\n"),
    git("tidy", "add", "tipjar.txt"),
    git("tidy", "commit", "-m", TIDY),
    git("tidy", "push", "origin", "tidy:main"),
    pause(400),
    say("tidy", "Wait. The prices say FREE. Blaze, we sell lemonade. For coins.", "surprised"),
    say("blaze", "Oh. Easy fix. I'll just reset main back and force-push...", "talking"),
    mood("tidy", "scared"),
    say("tidy", "No! My tip jar is on top of it. Lead, undo Blaze's change with a new commit. Leave the history alone.", "scared"),
  ],
  goals: [
    {
      id: "prices-back",
      description: "Undo Blaze's change: the prices on origin's main are back to coins",
      check: fileInTipEquals(remoteBranch("origin", "main"), "prices.txt", GOOD_PRICES),
    },
    {
      id: "history-kept",
      description: "Blaze's commit stays in the history (undo it, don't delete it)",
      check: originalCommitReachableFrom(remoteBranch("origin", "main"), BLAZE),
    },
    {
      id: "tip-jar-kept",
      description: "Tidy's tip jar stays on origin's main",
      check: allOf(
        originalCommitReachableFrom(remoteBranch("origin", "main"), TIDY),
        fileInTipEquals(remoteBranch("origin", "main"), "tipjar.txt", "Tips welcome\n"),
      ),
    },
  ],
  suggestions: ["git status", "git pull", "git log --oneline", "git show HEAD~1", "git diff HEAD~2 HEAD", "git push"],
  outro: [
    say("tidy", "Prices are back, the tip jar is still there, and history tells the truth.", "celebrate"),
    say("blaze", "So my commit is still in the log? Forever?", "guilty"),
    say("tidy", "With a polite little revert right after it. Everyone makes a free-lemonade commit once.", "happy"),
    say("blaze", "Only once. Probably.", "talking"),
  ],
};
