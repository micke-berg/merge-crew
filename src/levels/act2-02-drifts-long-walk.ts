import type { Level } from "@/engine/types";
import {
  allOf,
  fileInTipHasLines,
  originalCommitReachableFrom,
  remoteBranch,
  remoteBranchContains,
} from "./goals";
import { git, mood, pause, say, write } from "./script";

const PAINT = "Paint the sign";
export const PRICES = "Add the price list";
export const ICED_TEA = "Announce iced tea";
export const PRICE_TEA = "Price the iced tea";
export const DRIFT_CLOUD = "Draw a cloud";
export const DRIFT_SLOGAN = "Add a dreamy slogan";

export const MAIN_LINE = "Now with iced tea";
export const DRIFT_LINE = "Every cup comes with a cloud";

/*
 * The situation, verified step by step against real git 2.46 (bare origin, linked worktrees):
 *
 *   Setup (instant):
 *     player:  PAINT (sign.txt "LEMONADE / Open 9 to 5"), git push -u origin main
 *     drift:   worktree /crew/drift on branch drift, from that first commit.
 *              DRIFT_CLOUD (adds cloud.txt), DRIFT_SLOGAN (appends DRIFT_LINE to sign.txt)
 *     player:  PRICES, ICED_TEA (appends MAIN_LINE to sign.txt), PRICE_TEA, git push
 *   Drift never pulled, so main is three commits ahead of where drift started, and both sides
 *   appended a different line at the end of sign.txt.
 *
 *   Intro (scene): talk only. Drift asks for its branch to be merged.
 *
 *   Expected solution (merge):
 *     git merge drift      CONFLICT (content): Merge conflict in sign.txt
 *                          sign.txt holds <<<<<<< HEAD / MAIN_LINE / ======= / DRIFT_LINE / >>>>>>> drift
 *     (conflict editor)    keep both lines; the UI writes the file with engine.edit
 *     git add sign.txt
 *     git commit           concludes the merge with "Merge branch 'drift'" (no editor in the game)
 *     git push             fast-forward on origin
 *
 *   Also verified and accepted: bringing a copy of Drift's work up to date first.
 *     git rebase main drift is refused ('drift' is already used by worktree at /crew/drift), so:
 *     git switch -c drift-fresh drift; git rebase main   (stops on DRIFT_SLOGAN with the same conflict)
 *     (resolve) git add sign.txt; git rebase --continue
 *     git switch main; git merge drift-fresh (fast-forward); git push
 *   Not accepted: keeping only one side of the conflict, force-pushing drift over main, or
 *   rebasing main onto drift (main's pushed commits would be copied).
 */

export const level: Level = {
  id: "act2-02",
  act: 2,
  order: 2,
  title: "Drift's long walk",
  brief:
    "Drift started a branch long ago and never looked back at main. Now it wants in, and main has moved on. Bring Drift's work home and settle the conflict fairly.",
  mission: {
    situation:
      "Drift wrote a slogan for the café's sign on a branch it started long ago. Meanwhile main added its own new line to the sign, so the two clash.",
    job: "Merge Drift's branch into main, keep both new lines on the sign, and push the result to origin.",
    practise: ["git merge", "git add", "git commit", "git push"],
  },
  crew: ["drift", "tidy"],
  setup: [
    write("player", "sign.txt", "LEMONADE\nOpen 9 to 5\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", PAINT),
    git("player", "push", "-u", "origin", "main"),
    git("player", "worktree", "add", "/crew/drift", "-b", "drift"),
    write("drift", "cloud.txt", "  .--.\n (    )\n  `--`\n"),
    git("drift", "add", "cloud.txt"),
    git("drift", "commit", "-m", DRIFT_CLOUD),
    write("drift", "sign.txt", `LEMONADE\nOpen 9 to 5\n${DRIFT_LINE}\n`),
    git("drift", "add", "sign.txt"),
    git("drift", "commit", "-m", DRIFT_SLOGAN),
    write("player", "prices.txt", "Lemonade: 2 coins\n"),
    git("player", "add", "prices.txt"),
    git("player", "commit", "-m", PRICES),
    write("player", "sign.txt", `LEMONADE\nOpen 9 to 5\n${MAIN_LINE}\n`),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", ICED_TEA),
    write("player", "prices.txt", "Lemonade: 2 coins\nIced tea: 3 coins\n"),
    git("player", "add", "prices.txt"),
    git("player", "commit", "-m", PRICE_TEA),
    git("player", "push"),
  ],
  intro: [
    // Drift's signature float, coming back from wherever it has been.
    mood("drift", "happy"),
    pause(700),
    say("drift", "Hello. I wrote a slogan for the café's sign, sign.txt. And drew a cloud. It took a while.", "happy", ["sign.txt"]),
    say("tidy", "Look at the map, Drift. Your line starts at main's very first stop. Main has three new ones since.", "thinking"),
    say("drift", "Main moves? I thought it waited for me.", "surprised"),
    say("tidy", "And main added a line at the bottom of sign.txt too. Git can't pick one, so the merge will stop and ask.", "talking", ["sign.txt"]),
    say("drift", "Then you pick, Lead. Keep both, maybe. Mine is a little nicer.", "happy"),
  ],
  goals: [
    {
      id: "drift-on-origin",
      description: "Merge Drift's cloud and slogan into main and push them to origin",
      check: allOf(
        remoteBranchContains("origin", "main", DRIFT_CLOUD),
        remoteBranchContains("origin", "main", DRIFT_SLOGAN),
      ),
    },
    {
      id: "both-lines",
      description: "The sign keeps both new lines, with no conflict markers left",
      check: fileInTipHasLines(remoteBranch("origin", "main"), "sign.txt", ["LEMONADE", MAIN_LINE, DRIFT_LINE]),
    },
    {
      id: "main-kept",
      description: "Main's own commits stay exactly as they were (no rebase, no force)",
      check: allOf(
        originalCommitReachableFrom(remoteBranch("origin", "main"), PRICES),
        originalCommitReachableFrom(remoteBranch("origin", "main"), ICED_TEA),
        originalCommitReachableFrom(remoteBranch("origin", "main"), PRICE_TEA),
      ),
    },
  ],
  suggestions: [
    "git status",
    "git log --oneline --all",
    "git diff main drift",
    "git merge drift",
    "git add sign.txt",
    "git commit",
    "git push",
  ],
  outro: [
    say("drift", "Both lines on one sign. The iced tea and my cloud. Like neighbours.", "celebrate"),
    say("tidy", "Next time, pull main into your branch now and then. Small conflicts are easier than one big one.", "talking"),
    say("drift", "Now and then. I'll write that on a cloud.", "happy"),
  ],
};
