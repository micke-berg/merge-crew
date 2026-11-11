import type { Level } from "@/engine/types";
import { allOf, remoteBranchContains } from "./goals";
import { git, say, write } from "./script";

const OPEN = "Open the café";
export const PRICES = "Add the price list";
export const HOURS = "Add winter hours";

/*
 * A daily incident: played only at /daily, never listed in the acts. Checked against real git by
 * tests/oracle/levels.test.ts.
 *
 *   Tidy pushed PRICES to origin's main while the player committed HOURS locally. The café keeps main straight.
 *   Expected: git pull --rebase (HOURS is replayed on top of PRICES), git push.
 *   Also accepted: git fetch, git rebase origin/main, git push.
 *   Not accepted: a plain git pull, which makes a merge commit.
 */

export const level: Level = {
  id: "daily-03",
  act: 2,
  order: 103,
  title: "Straight home",
  par: 2,
  learned: "git pull --rebase replays your unpushed commits on top of what others pushed, so the shared history stays one straight line.",
  brief: "You saved the winter hours, and Tidy pushed the price list at the same moment. Get yours onto origin too, with no merge commit.",
  mission: {
    situation: "Your main and origin's main have each gained a commit the other lacks. A plain pull would join them with a merge commit, and this café keeps main as one straight line.",
    job: "Get your winter hours onto origin's main on top of Tidy's price list, without a merge commit.",
    practise: ["git status", "git fetch", "git pull --rebase", "git push"],
  },
  crew: ["tidy"],
  setup: [
    write("player", "sign.txt", "CAFÉ COG\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", OPEN),
    git("player", "push", "-u", "origin", "main"),
    git("player", "worktree", "add", "/crew/tidy", "-b", "tidy"),
    write("tidy", "prices.txt", "Lemonade: 2 coins\n"),
    git("tidy", "add", "prices.txt"),
    git("tidy", "commit", "-m", PRICES),
    git("tidy", "push", "origin", "tidy:main"),
    write("player", "hours.txt", "Winter: open 10 to 4\n"),
    git("player", "add", "hours.txt"),
    git("player", "commit", "-m", HOURS),
  ],
  intro: [
    say("tidy", "I pushed the price list a moment ago, lead. You saved the winter hours at the same time.", "talking"),
    say("tidy", "So origin has a commit you lack, and you have one origin lacks. A push will be refused.", "thinking"),
    say("tidy", "House style: main stays one straight line. Put your commit on top of mine, with no merge commit.", "talking"),
  ],
  goals: [
    {
      id: "both-on-origin",
      description: "Get your winter hours onto origin's main, on top of Tidy's price list",
      check: allOf(remoteBranchContains("origin", "main", PRICES), remoteBranchContains("origin", "main", HOURS)),
    },
    {
      id: "straight",
      description: "Origin's main stays one straight line: no merge commit",
      check: (state, queries) => {
        const tip = state.remotes.origin?.branches.main;
        return !!tip && queries.history(state, tip).every((c) => c.parents.length <= 1);
      },
    },
  ],
  suggestions: ["git status", "git fetch", "git log --oneline --all", "git push"],
  outro: [
    say("tidy", "Price list, then winter hours. One line, no knot in it.", "celebrate"),
    say("tidy", "Rebase only what you have not pushed yet. Then nobody else's history changes.", "happy"),
  ],
};
