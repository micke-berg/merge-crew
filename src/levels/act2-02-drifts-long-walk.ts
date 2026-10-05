import type { Level } from "@/engine/types";
import {
  allOf,
  fileInTipHasLines,
  originalCommitReachableFrom,
  remoteBranch,
  remoteBranchContains,
} from "./goals";
import { git, mood, pause, say, write, type Solution } from "./script";

const PAINT = "Paint the sign";
const PRICES = "Add the price list";
const ICED_TEA = "Announce iced tea";
const PRICE_TEA = "Price the iced tea";
const DRIFT_CLOUD = "Draw a cloud";
const DRIFT_SLOGAN = "Add a dreamy slogan";

const MAIN_LINE = "Now with iced tea";
const DRIFT_LINE = "Every cup comes with a cloud";

/** The sign after a fair resolution: both new lines kept. Either order is accepted by the goals. */
export const RESOLVED_SIGN = `LEMONADE\nOpen 9 to 5\n${MAIN_LINE}\n${DRIFT_LINE}\n`;

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
    say("drift", "Hello. I drew a cloud. And I wrote a slogan for the sign. It took a while.", "happy"),
    say("tidy", "Drift, your branch starts at the very first commit. Main has three new ones since.", "thinking"),
    say("drift", "Main moves? I thought it waited for me.", "surprised"),
    say("tidy", "It never waits. And you both added a line at the bottom of sign.txt. Git can't pick one for us.", "talking"),
    say("drift", "Then you pick, Lead. Both lines are nice. Mine is a little nicer.", "happy"),
  ],
  goals: [
    {
      id: "drift-on-origin",
      description: "Drift's cloud and slogan are on main on origin",
      check: allOf(
        remoteBranchContains("origin", "main", DRIFT_CLOUD),
        remoteBranchContains("origin", "main", DRIFT_SLOGAN),
      ),
    },
    {
      id: "both-lines",
      description: "The sign on origin keeps both new lines, with no conflict markers left",
      check: fileInTipHasLines(remoteBranch("origin", "main"), "sign.txt", ["LEMONADE", MAIN_LINE, DRIFT_LINE]),
    },
    {
      id: "main-kept",
      description: "Main's own commits stay exactly as they were",
      check: allOf(
        originalCommitReachableFrom(remoteBranch("origin", "main"), PRICES),
        originalCommitReachableFrom(remoteBranch("origin", "main"), ICED_TEA),
        originalCommitReachableFrom(remoteBranch("origin", "main"), PRICE_TEA),
      ),
    },
  ],
  hintContext: [
    "Merge conflict level. Drift's branch 'drift' started at main's first commit ('Paint the sign') and never pulled.",
    `Drift has two commits: '${DRIFT_CLOUD}' (adds cloud.txt) and '${DRIFT_SLOGAN}' (appends '${DRIFT_LINE}' to sign.txt).`,
    `Main has three newer commits, already pushed: '${PRICES}', '${ICED_TEA}' (appends '${MAIN_LINE}' to sign.txt) and '${PRICE_TEA}'.`,
    "Both sides appended a different line at the end of sign.txt, so they conflict. Nothing else overlaps.",
    "The branch 'drift' is checked out in Drift's worktree (/crew/drift), so the player cannot switch to it or rebase it in place.",
    "Intended fix: on main, git merge drift. It stops with a conflict in sign.txt.",
    "The player resolves it in the conflict editor, keeping both lines (either order is fine), then git add sign.txt and git commit",
    "(the game has no editor; a plain git commit uses the merge message), then git push.",
    "Also fine: a new branch from drift (git switch -c <name> drift), git rebase main, resolve, git add, git rebase --continue,",
    "then switch to main, merge that branch and push.",
    "Goals: both Drift commits reachable from origin's main; origin's sign.txt has both lines and no conflict markers;",
    "main's three commits are still the originals (not rebased or copied). No force-push is needed or wanted.",
    "Good first nudges: git log --oneline --all shows how far apart the lines are; git status during a conflict names the file.",
  ].join("\n"),
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

/** Verified against real git 2.46. See the comment at the top of this file. The edit step stands in for the conflict editor. */
export const solution: Solution = [
  git("player", "merge", "drift"),
  write("player", "sign.txt", RESOLVED_SIGN),
  git("player", "add", "sign.txt"),
  git("player", "commit"),
  git("player", "push"),
];
