import type { Level } from "@/engine/types";
import { allOf, branch, commitWithMessageReachableFrom, fileInTipEquals, remoteBranch, remoteBranchContains } from "./goals";
import { git, mood, pause, point, say, write } from "./script";

const OPEN = "Open the café";
export const HOURS = "Add winter hours";
export const SOUP = "Add soup to the menu";
export const BANNER = "Add a sale banner";
export const FASTER = "Make the site faster";

const SIGN = "CAFÉ COG\n";
const MENU = "Lemonade\nIced tea\n";
export const PRICES = "Lemonade: 2 coins\nIced tea: 3 coins\n";

/*
 * The situation, verified step by step against real git (bare origin, linked worktrees):
 *
 *   Setup (instant):
 *     player:   OPEN on main (sign.txt, menu.txt, prices.txt), git push -u origin main
 *     tidy:     worktree /crew/tidy on branch tidy-hours: HOURS (new file hours.txt)
 *     hoarder:  worktree /crew/hoarder on branch hoarder-soup: SOUP (menu.txt gains a line)
 *     blaze:    worktree /crew/blaze on branch blaze-sale: BANNER (sign.txt gains a line), then
 *               FASTER, whose message says nothing about it but which deletes prices.txt
 *
 *   Intro (scene): talk only. Each robot says its branch is ready.
 *
 *   Expected solution:
 *     git log --oneline --all            the three branches and their commits
 *     git show --stat blaze-sale         FASTER: prices.txt deleted
 *     git merge tidy-hours               fast-forward
 *     git merge hoarder-soup             merge commit, no conflict
 *     git push                           fast-forward on origin
 *   Real git result: origin/main has HOURS and SOUP and still has prices.txt; blaze-sale is not merged.
 *
 *   Also accepted: cherry-picking BANNER (the good half of Blaze's branch), or merging blaze-sale
 *   and then putting prices.txt back with a revert. Not accepted: leaving prices.txt deleted on main.
 */

export const level: Level = {
  id: "act3-01",
  act: 3,
  order: 1,
  title: "Read before you merge",
  par: 3,
  learned: "A commit message says what someone meant to do. The diff shows what they did. Read it before you merge.",
  brief:
    "Three robots say their branches are ready for main. Two are. Read what each branch really changes, merge the safe ones and leave the other out.",
  mission: {
    situation:
      "Tidy, Hoarder and Blaze have each finished a branch and want it merged into main, the version the café's website is built from. Nobody has checked their work.",
    job: "Read what each branch changes. Merge the ones that are safe, push main to origin, and make sure the café loses none of its files.",
    practise: ["git log --oneline --all", "git show --stat", "git diff main...branch", "git merge", "git push"],
  },
  crew: ["tidy", "hoarder", "blaze"],
  setup: [
    write("player", "sign.txt", SIGN),
    write("player", "menu.txt", MENU),
    write("player", "prices.txt", PRICES),
    git("player", "add", "sign.txt", "menu.txt", "prices.txt"),
    git("player", "commit", "-m", OPEN),
    git("player", "push", "-u", "origin", "main"),
    git("player", "worktree", "add", "/crew/tidy", "-b", "tidy-hours"),
    git("player", "worktree", "add", "/crew/hoarder", "-b", "hoarder-soup"),
    git("player", "worktree", "add", "/crew/blaze", "-b", "blaze-sale"),
    write("tidy", "hours.txt", "Winter: open 10 to 4\n"),
    git("tidy", "add", "hours.txt"),
    git("tidy", "commit", "-m", HOURS),
    write("hoarder", "menu.txt", `${MENU}Soup\n`),
    git("hoarder", "add", "menu.txt"),
    git("hoarder", "commit", "-m", SOUP),
    write("blaze", "sign.txt", `${SIGN}SALE! SALE! SALE!\n`),
    git("blaze", "add", "sign.txt"),
    git("blaze", "commit", "-m", BANNER),
    git("blaze", "rm", "prices.txt"),
    git("blaze", "commit", "-m", FASTER),
  ],
  intro: [
    say("tidy", "Three branches are waiting for you, lead. Mine adds the winter hours.", "talking"),
    say("hoarder", "Mine puts soup on the menu. I saved it in a commit. A real one!", "happy"),
    mood("blaze", "celebrate"),
    pause(700),
    say("blaze", "Mine is a sale banner, and I made the site faster too. It's all good. Just merge it!", "happy"),
    point("tidy", "map", "Each coloured line is one robot's branch. None of it is in main yet.", {
      mood: "thinking",
      focus: { branches: ["tidy-hours", "hoarder-soup", "blaze-sale"] },
    }),
    say("tidy", "A message says what a robot meant to do. The diff says what it did. Read before you merge, lead.", "thinking"),
  ],
  goals: [
    {
      id: "safe-merged",
      description: "Read the three branches and merge the safe ones into main",
      check: allOf(commitWithMessageReachableFrom(branch("main"), HOURS), commitWithMessageReachableFrom(branch("main"), SOUP)),
    },
    {
      id: "pushed",
      description: "Push main to origin, so the website gets the new work",
      check: allOf(remoteBranchContains("origin", "main", HOURS), remoteBranchContains("origin", "main", SOUP)),
    },
    {
      id: "nothing-missing",
      description: "The café keeps every file it has: nothing goes missing from main",
      check: allOf(
        fileInTipEquals(branch("main"), "prices.txt", PRICES),
        fileInTipEquals(remoteBranch("origin", "main"), "prices.txt", PRICES),
      ),
    },
  ],
  suggestions: ["git log --oneline --all", "git show --stat tidy-hours", "git diff main...hoarder-soup", "git branch", "git push"],
  outro: [
    say("blaze", "Hey, you left mine out! ... Oh. I deleted the price list. It was slowing down my scrolling.", "guilty"),
    say("tidy", "The message said faster. The diff said deleted. That is why the lead reads first.", "talking"),
    say("hoarder", "My soup is on main. I might commit again some day.", "celebrate"),
    say("blaze", "I'll put the prices back and ask again. Slower this time.", "talking"),
  ],
};
