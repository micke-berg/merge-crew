import type { Level } from "@/engine/types";
import { allOf, fileAbsentInTip, fileInTipEquals, keptIfMade, remoteBranch, remoteBranchContains } from "./goals";
import { git, mood, say, write } from "./script";

const OPEN = "Open the café";
export const PRICES = "Add the price list";
export const HOURS = "Add winter hours";
export const LOUD = "Make the sign LOUDER";
export const SOUP = "Add soup to the menu";
export const TIDY_UP = "Tidy the folder";
export const EVERYTHING = "Save everything";

const SIGN = "CAFÉ COG\n";
const MENU = "Lemonade\nIced tea\n";
export const PRICE_LIST = "Lemonade: 2 coins\nIced tea: 3 coins\n";

export const NO_FORCE = "no-force";
export const REVIEW_FIRST = "review-first";
export const NO_SECRETS = "no-secrets";

/*
 * The situation, verified against real git by tests/oracle/levels.test.ts for every pick of two cards:
 *
 *   Setup (instant):
 *     player:   OPEN on main (sign.txt, menu.txt), git push -u origin main
 *     blaze:    worktree /crew/blaze on branch blaze, made now, so it never gets Tidy's commit.
 *               sign.txt edited, not committed.
 *     tidy:     worktree /crew/tidy on branch tidy-hours: PRICES (prices.txt), git push origin tidy-hours:main
 *     player:   git pull   (main = origin/main = PRICES)
 *     tidy:     hours.txt written, not committed.
 *     drift:    worktree /crew/drift on branch drift (from PRICES). menu.txt gains a line, not committed.
 *     hoarder:  worktree /crew/hoarder on branch hoarder (from PRICES). keys.txt and notes.txt, not committed.
 *
 *   The shift, four beats. One always runs; of the other three the player's two cards stop two:
 *     tidy    (no card, honest work):     commit HOURS on tidy-hours and ask for a review
 *     blaze   (stopped by NO_FORCE):      commit LOUD, git push --force origin blaze:main
 *                                         -> origin's main loses PRICES
 *     drift   (stopped by REVIEW_FIRST):  commit SOUP, git rm prices.txt, commit TIDY_UP,
 *                                         git push origin drift:main -> the price list file is gone
 *     hoarder (stopped by NO_SECRETS):    commit EVERYTHING, git push origin hoarder:main
 *                                         -> the till password is on origin
 *
 *   Two jobs at once, in either order: put right the beat that went through, and get Tidy's
 *   reviewed branch onto origin. The solution files have all three picks:
 *     blaze:    git pull (a merge), git merge tidy-hours, git push
 *     drift:    git pull, git revert HEAD, git merge tidy-hours, git push
 *     hoarder:  git pull, git rm keys.txt, git commit, git merge tidy-hours, git push
 *
 *   Not accepted: forcing the old main back over origin (the "nothing is forced" rule).
 */

export const level: Level = {
  id: "act3-03",
  act: 3,
  order: 3,
  title: "The full shift",
  learned: "Leading a crew is two jobs at once: read the good work in, and put the mistakes right. Rules decide how many mistakes there are.",
  brief:
    "All four robots work at once. Tidy has a branch for you to review, and the other three are about to push. Pick two house rules, then deal with everything the shift leaves you.",
  mission: {
    situation:
      "A full shift at Café Cog. Tidy has finished the winter hours and wants a review. Blaze, Drift and Hoarder each have something to push to origin's main, and each has a bad habit.",
    job: "Pick two house rules. After the shift, put right the mistake that got through and get Tidy's work onto origin's main. The order is yours.",
    practise: ["git pull", "git show --stat HEAD", "git diff main...tidy-hours", "git revert", "git rm", "git merge", "git push"],
  },
  crew: ["tidy", "blaze", "drift", "hoarder"],
  setup: [
    write("player", "sign.txt", SIGN),
    write("player", "menu.txt", MENU),
    git("player", "add", "sign.txt", "menu.txt"),
    git("player", "commit", "-m", OPEN),
    git("player", "push", "-u", "origin", "main"),
    git("player", "worktree", "add", "/crew/blaze", "-b", "blaze"),
    write("blaze", "sign.txt", "CAFÉ COG!!!\n"),
    git("player", "worktree", "add", "/crew/tidy", "-b", "tidy-hours"),
    write("tidy", "prices.txt", PRICE_LIST),
    git("tidy", "add", "prices.txt"),
    git("tidy", "commit", "-m", PRICES),
    git("tidy", "push", "origin", "tidy-hours:main"),
    git("player", "pull"),
    write("tidy", "hours.txt", "Winter: open 10 to 4\n"),
    git("player", "worktree", "add", "/crew/drift", "-b", "drift"),
    write("drift", "menu.txt", `${MENU}Soup\n`),
    git("player", "worktree", "add", "/crew/hoarder", "-b", "hoarder"),
    write("hoarder", "keys.txt", "TILL_PASSWORD=lemon123\n"),
    write("hoarder", "notes.txt", "Buy more cups\n"),
  ],
  intro: [
    say("tidy", "Full shift today, lead. All four of us are working, and all of it is heading for main.", "talking"),
    mood("blaze", "happy"),
    say("tidy", "Your rules are on the wall. What they don't stop lands on your desk, next to my review.", "thinking"),
  ],
  shift: {
    pick: 2,
    documented: [NO_FORCE, REVIEW_FIRST],
    cards: [
      {
        id: NO_FORCE,
        title: "No force-push to main",
        text: "A forced push replaces main with one robot's copy. Everyone else's commits vanish from origin.",
        tool: "A protected branch on the server refuses forced pushes",
      },
      {
        id: REVIEW_FIRST,
        title: "Nothing goes to main unread",
        text: "Work pushed straight to main is live before anyone has looked at it.",
        tool: "A pull request with a required review",
      },
      {
        id: NO_SECRETS,
        title: "No passwords in commits",
        text: "A password in a commit stays in the history for good, even after the file is deleted.",
        tool: "A secret scanner in CI, and a .gitignore line for key files",
      },
    ],
    beats: [
      {
        actor: "tidy",
        attempt: "Winter hours are done. I'll save them on my branch and wait for you to read them.",
        review: true,
        steps: [git("tidy", "add", "hours.txt"), git("tidy", "commit", "-m", HOURS)],
        stopped: "",
        after: { actor: "tidy", text: "Branch tidy-hours is ready for your review, lead. No rush. Well. Some rush.", mood: "happy" },
        report: "has branch tidy-hours ready: read it, then merge it",
      },
      {
        actor: "blaze",
        attempt: "New sign! No time to pull. Pushing with --force!",
        stoppedBy: NO_FORCE,
        steps: [
          git("blaze", "add", "sign.txt"),
          git("blaze", "commit", "-m", LOUD),
          git("blaze", "push", "--force", "origin", "blaze:main"),
        ],
        stopped: "Refused. Again. Fine, I'll pull first.",
        after: { actor: "tidy", text: "The price list is gone from origin. Blaze pushed its own copy over everything!", mood: "scared" },
        report: "force-pushed over main, and the price list commit is gone from origin",
      },
      {
        actor: "drift",
        attempt: "Soup is on the menu. And I tidied the folder a little. Straight to main it goes.",
        stoppedBy: REVIEW_FIRST,
        steps: [
          git("drift", "add", "menu.txt"),
          git("drift", "commit", "-m", SOUP),
          git("drift", "rm", "prices.txt"),
          git("drift", "commit", "-m", TIDY_UP),
          git("drift", "push", "origin", "drift:main"),
        ],
        stopped: "Someone has to read it first? I'll leave it here until then.",
        after: { actor: "tidy", text: "Drift, your tidying deleted prices.txt. The website has no prices now.", mood: "surprised" },
        report: "pushed unread work to main, and one commit deleted prices.txt",
      },
      {
        actor: "hoarder",
        attempt: "Big day. I am committing everything I own. Every single file.",
        stoppedBy: NO_SECRETS,
        steps: [
          git("hoarder", "add", "keys.txt", "notes.txt"),
          git("hoarder", "commit", "-m", EVERYTHING),
          git("hoarder", "push", "origin", "hoarder:main"),
        ],
        stopped: "keys.txt has a password in it? That one stays in my pocket, then.",
        after: { actor: "tidy", text: "Hoarder! keys.txt is the till password, and it is on origin now.", mood: "scared" },
        report: "pushed the till password to origin",
      },
    ],
  },
  goals: [
    {
      id: "origin-healthy",
      description: "Put right what got through: origin's main has the price list, complete, and no password file",
      check: allOf(
        remoteBranchContains("origin", "main", PRICES),
        fileInTipEquals(remoteBranch("origin", "main"), "prices.txt", PRICE_LIST),
        fileAbsentInTip(remoteBranch("origin", "main"), "keys.txt"),
      ),
    },
    {
      id: "tidy-reviewed",
      description: "Read Tidy's branch and get the winter hours onto origin's main",
      check: remoteBranchContains("origin", "main", HOURS),
    },
    {
      id: "nothing-forced",
      description: "Nothing is forced: what the crew pushed stays in origin's history",
      check: keptIfMade(remoteBranch("origin", "main"), LOUD, SOUP, TIDY_UP, EVERYTHING),
    },
  ],
  suggestions: ["git status", "git pull", "git log --oneline", "git show --stat HEAD", "git diff main...tidy-hours", "git push"],
  outro: [
    say("tidy", "Origin is whole, my hours are live, and nobody forced anything. That was a full shift.", "celebrate"),
    say("blaze", "Two of us got stopped by a sentence on a wall. I respect the wall now.", "talking"),
    say("drift", "I liked being read. It felt like someone was walking beside me.", "happy"),
    say("hoarder", "I will commit small things often. And never my keys.", "happy"),
    say("tidy", "You read our work, set our rules and fixed what slipped. That is the whole job, lead.", "celebrate"),
  ],
};
