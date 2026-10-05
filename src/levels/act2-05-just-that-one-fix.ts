import type { Level } from "@/engine/types";
import {
  allOf,
  branchPointsAt,
  fileInTipEquals,
  noCommitWithMessageReachableFrom,
  remoteBranch,
  remoteBranchContains,
} from "./goals";
import { git, pause, mood, say, write } from "./script";

const BUILD = "Build the stand";
const PRICES = "Add the price list";
const HOURS = "Add opening hours";
const CLOUDS = "Paint clouds on the cups";
const FIX = "Fix the wobbly table";
const POEM = "Write a poem about lemons";

const WOBBLY = "Table legs: 3 long, 1 short\n";
const FIXED = "Table legs: 4 long\n";

/*
 * The situation, verified step by step against real git 2.46 (bare origin, linked worktrees):
 *
 *   Setup (instant):
 *     player:  BUILD (sign.txt, table.txt = WOBBLY), git push -u origin main
 *     drift:   worktree /crew/drift on branch drift, from BUILD.
 *              CLOUDS (cups.txt), FIX (table.txt = FIXED), POEM (poem.txt). Never merged, never pushed.
 *     player:  PRICES (prices.txt), HOURS (sign.txt), git push
 *
 *   Intro (scene): talk only. The table on main still wobbles; Drift fixed it long ago on its branch.
 *
 *   Expected solution:
 *     git log --oneline drift     POEM, FIX, CLOUDS, BUILD
 *     git cherry-pick drift~1     a copy of FIX on main (table.txt only, no conflict)
 *     git push                    fast-forward on origin
 *   Real git result: origin/main BUILD - PRICES - HOURS - FIX(copy); no cups.txt or poem.txt on main;
 *   branch drift unchanged at POEM.
 *
 *   Also accepted: git cherry-pick <oid of FIX>. Not accepted: git merge drift (brings the clouds and
 *   the poem along), or moving Drift's branch.
 */

export const level: Level = {
  id: "act2-05",
  act: 2,
  order: 5,
  title: "Just that one fix",
  brief:
    "The stand's table wobbles. Drift fixed it ages ago, on a branch full of other half-finished dreams. Bring over the fix, and only the fix.",
  crew: ["drift", "tidy"],
  setup: [
    write("player", "sign.txt", "LEMONADE\n"),
    write("player", "table.txt", WOBBLY),
    git("player", "add", "sign.txt", "table.txt"),
    git("player", "commit", "-m", BUILD),
    git("player", "push", "-u", "origin", "main"),
    git("player", "worktree", "add", "/crew/drift", "-b", "drift"),
    write("drift", "cups.txt", "Cups with clouds on\n"),
    git("drift", "add", "cups.txt"),
    git("drift", "commit", "-m", CLOUDS),
    write("drift", "table.txt", FIXED),
    git("drift", "add", "table.txt"),
    git("drift", "commit", "-m", FIX),
    write("drift", "poem.txt", "Ode to a lemon\nYou are yellow\nThe end\n"),
    git("drift", "add", "poem.txt"),
    git("drift", "commit", "-m", POEM),
    write("player", "prices.txt", "Lemonade: 2 coins\n"),
    git("player", "add", "prices.txt"),
    git("player", "commit", "-m", PRICES),
    write("player", "sign.txt", "LEMONADE\nOpen 9 to 5\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", HOURS),
    git("player", "push"),
  ],
  intro: [
    mood("tidy", "surprised"),
    say("tidy", "A customer's lemonade just slid off the table. Again. One leg is short.", "surprised"),
    say("drift", "Oh, the table. I fixed that. A long time ago. I think it was a Tuesday.", "happy"),
    say("tidy", "Fixed it where? Main still wobbles.", "thinking"),
    say("drift", "On my branch. Between the clouds on the cups and my poem about lemons.", "happy"),
    pause(400),
    say("tidy", "The cups aren't finished, and the poem is... a poem. We only want the fix.", "talking"),
    say("drift", "You can take one stop from my line without the others? Git is so generous.", "surprised"),
  ],
  goals: [
    {
      id: "fix-on-origin",
      description: "Drift's table fix is on main on origin",
      check: allOf(
        remoteBranchContains("origin", "main", FIX),
        fileInTipEquals(remoteBranch("origin", "main"), "table.txt", FIXED),
      ),
    },
    {
      id: "only-the-fix",
      description: "Only the fix: the cloud cups and the poem stay off main",
      check: allOf(
        noCommitWithMessageReachableFrom(remoteBranch("origin", "main"), CLOUDS),
        noCommitWithMessageReachableFrom(remoteBranch("origin", "main"), POEM),
      ),
    },
    {
      id: "drift-untouched",
      description: "Drift's branch stays as it is",
      check: branchPointsAt("drift", POEM),
    },
  ],
  hintContext: [
    "Cherry-pick level. main: 'Build the stand' (sign.txt, table.txt with a short leg), then 'Add the price list' and 'Add opening hours'. All pushed.",
    `Drift's branch 'drift' started at 'Build the stand' and has three commits, oldest first: '${CLOUDS}' (cups.txt),`,
    `'${FIX}' (table.txt: 4 long legs) and '${POEM}' (poem.txt). It was never merged or pushed.`,
    "The branch is checked out in Drift's worktree. The fix is drift~1, the middle commit.",
    "Intended fix: git log --oneline drift to find the fix, git cherry-pick drift~1 (or its id), then git push. No conflicts.",
    "Goals: origin's main has the fix and the fixed table.txt; neither the clouds commit nor the poem commit is on origin's main;",
    "branch drift still points at the poem commit.",
    "Steer away from git merge drift: it brings the unfinished cups and the poem along.",
    "Good first nudges: git log on another branch lists its commits; git show <commit> shows what one commit changed.",
  ].join("\n"),
  suggestions: ["git status", "git log --oneline --all", "git log --oneline drift", "git show drift~1", "git push"],
  outro: [
    say("tidy", "Four legs, no wobble. And no poem on main.", "celebrate"),
    say("drift", "The fix went home and the rest of my line stayed where it was. Like a train that only takes one passenger.", "happy"),
    say("tidy", "Next time, a small branch for a small fix. Then it can go home on its own.", "talking"),
  ],
};
