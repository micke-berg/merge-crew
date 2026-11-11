import type { Level } from "@/engine/types";
import { allOf, fileAbsentInTip, fileInTipEquals, keptIfMade, remoteBranch, remoteBranchContains } from "./goals";
import { git, mood, say, write } from "./script";

const OPEN = "Open the café";
export const PRICES = "Add the price list";
export const LOUD = "Make the sign LOUDER";
export const WIP = "wip menu ideas";
export const EVERYTHING = "Save everything";

const SIGN = "CAFÉ COG\n";
export const MENU = "Lemonade\nIced tea\n";

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
 *     tidy:     worktree /crew/tidy on branch tidy: PRICES (prices.txt), git push origin tidy:main
 *     player:   git pull   (main = origin/main = PRICES)
 *     drift:    worktree /crew/drift on branch drift (from PRICES). menu.txt scribbled on, not committed.
 *     hoarder:  worktree /crew/hoarder on branch hoarder (from PRICES). keys.txt (the till password)
 *               and notes.txt written, not committed.
 *
 *   The shift, three beats. The player picked two cards, so exactly one beat goes through:
 *     blaze   (stopped by NO_FORCE):      commit LOUD, git push --force origin blaze:main
 *                                         -> origin's main loses PRICES
 *     drift   (stopped by REVIEW_FIRST):  commit WIP, git push origin drift:main
 *                                         -> half-finished scribbles on the menu the website shows
 *     hoarder (stopped by NO_SECRETS):    commit EVERYTHING, git push origin hoarder:main
 *                                         -> the till password is on origin
 *
 *   The fix for the beat that went through (the solution files have all three):
 *     blaze:    git pull (a merge: PRICES and LOUD), git push
 *     drift:    git pull (fast-forward), git revert HEAD, git push
 *     hoarder:  git pull (fast-forward), git rm keys.txt, git commit, git push
 *
 *   Not accepted: forcing the old main back over origin, which cuts the robot's commit out of the
 *   shared history (the "nothing is forced" rule).
 */

export const level: Level = {
  id: "act3-02",
  act: 3,
  order: 2,
  title: "House rules",
  learned: "A rule that stops a mistake is cheaper than fixing it. Real teams use protected branches, reviews and secret scanners.",
  brief:
    "Three robots are about to push to main, and each has a bad habit. Pick two house rules before the shift starts. The rules stop two mistakes. You fix the third.",
  mission: {
    situation:
      "Blaze, Drift and Hoarder each have work to push to origin's main, the copy the café's website is built from. Left alone, each of them will break it in its own way.",
    job: "Pick two house rules. Watch the shift. Then put right whatever your rules did not stop, without forcing anything.",
    practise: ["git pull", "git log --oneline", "git show --stat HEAD", "git revert", "git rm", "git push"],
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
    git("player", "worktree", "add", "/crew/tidy", "-b", "tidy"),
    write("tidy", "prices.txt", "Lemonade: 2 coins\nIced tea: 3 coins\n"),
    git("tidy", "add", "prices.txt"),
    git("tidy", "commit", "-m", PRICES),
    git("tidy", "push", "origin", "tidy:main"),
    git("player", "pull"),
    git("player", "worktree", "add", "/crew/drift", "-b", "drift"),
    write("drift", "menu.txt", `${MENU}something with clouds?? finish later\n`),
    git("player", "worktree", "add", "/crew/hoarder", "-b", "hoarder"),
    write("hoarder", "keys.txt", "TILL_PASSWORD=lemon123\n"),
    write("hoarder", "notes.txt", "Buy more cups\n"),
  ],
  intro: [
    say("tidy", "The shift starts now, lead. Blaze, Drift and Hoarder each have something to push to main.", "talking"),
    mood("blaze", "happy"),
    say("tidy", "Your house rules are on the wall. The crew cannot break a rule. Anything else, they will do.", "thinking"),
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
        actor: "blaze",
        attempt: "Sign's done! Pulling takes ages, so I'll just push with --force.",
        stoppedBy: NO_FORCE,
        steps: [
          git("blaze", "add", "sign.txt"),
          git("blaze", "commit", "-m", LOUD),
          git("blaze", "push", "--force", "origin", "blaze:main"),
        ],
        stopped: "Refused? Fine. I'll pull first like everyone else. Slowly.",
        after: { actor: "tidy", text: "My price list just vanished from origin. Blaze pushed its own copy over it!", mood: "scared" },
        report: "force-pushed over main, and the price list is gone from origin",
      },
      {
        actor: "drift",
        attempt: "I had a thought about the menu. Not a finished thought. I'll push it to main so I don't lose it.",
        stoppedBy: REVIEW_FIRST,
        steps: [
          git("drift", "add", "menu.txt"),
          git("drift", "commit", "-m", WIP),
          git("drift", "push", "origin", "drift:main"),
        ],
        stopped: "Oh. Someone has to read it first. It isn't really ready to be read.",
        after: { actor: "tidy", text: "The website's menu now says 'something with clouds??'. That was a note, Drift.", mood: "surprised" },
        report: "pushed unfinished notes straight onto the menu",
      },
      {
        actor: "hoarder",
        attempt: "I never commit. Today I commit EVERYTHING. Every file I have. All at once.",
        stoppedBy: NO_SECRETS,
        steps: [
          git("hoarder", "add", "keys.txt", "notes.txt"),
          git("hoarder", "commit", "-m", EVERYTHING),
          git("hoarder", "push", "origin", "hoarder:main"),
        ],
        stopped: "It says keys.txt has a password in it. I'll keep that one in my pocket.",
        after: { actor: "tidy", text: "Hoarder! keys.txt is the till password, and it is on origin now.", mood: "scared" },
        report: "pushed the till password to origin",
      },
    ],
  },
  goals: [
    {
      id: "origin-healthy",
      description: "Put right what got through: origin's main has the price list, a clean menu and no password file",
      check: allOf(
        remoteBranchContains("origin", "main", PRICES),
        fileInTipEquals(remoteBranch("origin", "main"), "menu.txt", MENU),
        fileAbsentInTip(remoteBranch("origin", "main"), "keys.txt"),
      ),
    },
    {
      id: "nothing-forced",
      description: "Nothing is forced: what the crew pushed stays in origin's history",
      check: keptIfMade(remoteBranch("origin", "main"), LOUD, WIP, EVERYTHING),
    },
  ],
  suggestions: ["git status", "git pull", "git log --oneline", "git show --stat HEAD", "git push"],
  outro: [
    say("tidy", "Origin is healthy again. Two mistakes never happened, because of your rules. One you fixed by hand.", "celebrate"),
    say("blaze", "Rules are faster than fixing. I can't believe I'm saying that.", "talking"),
    say("hoarder", "If a password ever gets out, deleting the file is not enough. It stays in the history. Change the password too.", "thinking"),
    say("tidy", "Next shift, everyone works at once. Pick your rules well, lead.", "happy"),
  ],
};
