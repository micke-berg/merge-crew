import type { Level } from "@/engine/types";
import {
  noLostCommits,
  originalCommitReachableFrom,
  remoteBranch,
  remoteBranchContains,
  allOf,
} from "./goals";
import { git, mood, pause, say, write } from "./script";

const TIDY_1 = "Add the price list";
const TIDY_2 = "Add iced tea to the prices";
const BLAZE = "Make the sign LOUDER";

/*
 * The situation, verified step by step against real git 2.46 (bare origin, linked worktrees):
 *
 *   Setup (instant):
 *     player:  "Paint the sign", "Add opening hours" on main, pushed with -u to origin.
 *     tidy:    worktree /crew/tidy on branch tidy, commits TIDY_1 and TIDY_2,
 *              git push origin tidy:main            (origin/main moves forward to TIDY_2)
 *     player:  git pull                             (fast-forward, local main = TIDY_2)
 *     blaze:   worktree /crew/blaze on branch blaze, started before Tidy's work,
 *              commits BLAZE (sign.txt only, so no overlap with Tidy's prices.txt)
 *
 *   Intro (played as a scene):
 *     blaze:   git push --force origin blaze:main   (origin/main = BLAZE, Tidy's commits gone from origin)
 *     Blaze then "helpfully syncs everyone":
 *     player:  git fetch; git reset --hard origin/main   (local main = BLAZE)
 *     tidy:    git reset --hard origin/main              (branch tidy = BLAZE)
 *   Now no branch, remote branch or worktree HEAD reaches TIDY_1 or TIDY_2. git fsck --unreachable
 *   lists both. They survive only in reflogs. The player's reflog reads:
 *     HEAD@{0}: reset: moving to origin/main
 *     HEAD@{1}: pull: Fast-forward                  <- TIDY_2
 *
 *   Expected solution (no force-push, nothing rewritten):
 *     git reflog                         find TIDY_2 at HEAD@{1} / main@{1}
 *     git branch tidy-rescue main@{1}    give the lost commits a name again
 *     git merge tidy-rescue              real merge: BLAZE + TIDY_1 + TIDY_2
 *     git push                           fast-forward origin/main, no --force needed
 *   Real git result on origin: "Merge branch 'tidy-rescue'" with parents BLAZE and TIDY_2;
 *   git fsck --unreachable --no-reflogs is empty afterwards.
 *
 *   Also accepted: git merge main@{1} directly, or cherry-picking Tidy's commits as long as a
 *   branch keeps the originals reachable. Not accepted: force-pushing main@{1} over origin
 *   (Blaze's commit would drop off origin) or rebasing Blaze's commit (it would be copied).
 */

export const level: Level = {
  id: "act2-01",
  act: 2,
  order: 1,
  title: "Blaze was in a hurry",
  brief:
    "Blaze pushed to main with --force. Tidy's work has vanished from origin and from your checkout. Find it and bring it back without rewriting anything.",
  mission: {
    situation:
      "Blaze made the café's sign louder and pushed it with --force, which overwrites whatever is there. That wiped Tidy's price list off origin, the shared copy the website is built from, and out of your files.",
    job: "Find Tidy's lost price list and put it back on origin next to Blaze's sign, without forcing anything.",
    practise: ["git reflog", "git branch", "git merge", "git push"],
  },
  crew: ["tidy", "blaze"],
  setup: [
    write("player", "sign.txt", "LEMONADE\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", "Paint the sign"),
    write("player", "hours.txt", "Open 9 to 5\n"),
    git("player", "add", "hours.txt"),
    git("player", "commit", "-m", "Add opening hours"),
    git("player", "push", "-u", "origin", "main"),
    git("player", "worktree", "add", "/crew/tidy", "-b", "tidy"),
    git("player", "worktree", "add", "/crew/blaze", "-b", "blaze"),
    write("tidy", "prices.txt", "Lemonade: 2 coins\n"),
    git("tidy", "add", "prices.txt"),
    git("tidy", "commit", "-m", TIDY_1),
    write("tidy", "prices.txt", "Lemonade: 2 coins\nIced tea: 3 coins\n"),
    git("tidy", "add", "prices.txt"),
    git("tidy", "commit", "-m", TIDY_2),
    git("tidy", "push", "origin", "tidy:main"),
    git("player", "pull"),
    write("blaze", "sign.txt", "LEMONADE!!!\n"),
    git("blaze", "add", "sign.txt"),
    git("blaze", "commit", "-m", BLAZE),
  ],
  intro: [
    say("blaze", "Done! The café's sign, sign.txt, is LOUDER now. Shipping it with --force. No time to pull.", "happy", ["sign.txt"]),
    say("tidy", "Wait! I put the price list, prices.txt, on origin this morning. Origin is the shared copy!", "scared", ["prices.txt"]),
    // The overconfident wheelie (Blaze's signature), right before the force-push.
    mood("blaze", "celebrate"),
    pause(900),
    git("blaze", "push", "--force", "origin", "blaze:main"),
    pause(600),
    say("blaze", "Boom. And I reset everyone's files to match the new main. You're welcome!", "happy"),
    git("player", "fetch"),
    git("player", "reset", "--hard", "origin/main"),
    git("tidy", "reset", "--hard", "origin/main"),
    pause(400),
    mood("tidy", "scared"),
    say("tidy", "My price list is gone. From origin and from your files. Blaze!", "scared"),
    say("tidy", "Git's reflog remembers where main has been. Lead, bring my price list back, without forcing anything.", "thinking"),
  ],
  goals: [
    {
      id: "tidy-back-on-origin",
      description: "Get Tidy's price list (both commits) back onto main on origin",
      check: allOf(remoteBranchContains("origin", "main", TIDY_1), remoteBranchContains("origin", "main", TIDY_2)),
    },
    {
      id: "blaze-kept",
      description: "Keep Blaze's louder sign on origin's main too, as it is",
      check: originalCommitReachableFrom(remoteBranch("origin", "main"), BLAZE),
    },
    {
      id: "nothing-lost",
      description: "Nothing is lost: every commit is reachable again",
      check: noLostCommits(),
    },
  ],
  hintContext: [
    "Recovery level: a force-push removed commits from origin, and the local checkouts were reset to match.",
    `Before the scene: origin/main had 'Paint the sign', 'Add opening hours', then Tidy's '${TIDY_1}' and '${TIDY_2}' (prices.txt).`,
    "The player had pulled, so local main was at Tidy's second commit.",
    `Blaze's branch 'blaze' started before Tidy's work and has one commit, '${BLAZE}' (sign.txt only, no overlap with prices.txt).`,
    "In the scene Blaze ran git push --force origin blaze:main, then reset the player's main and Tidy's branch to origin/main.",
    "Now no branch, remote branch or worktree reaches Tidy's two commits. They exist only in the reflog.",
    "The player's reflog: HEAD@{0} 'reset: moving to origin/main' (Blaze's commit), HEAD@{1} 'pull: Fast-forward' (Tidy's second commit).",
    "main@{1} and HEAD@{1} both point at Tidy's second commit, whose parent is Tidy's first.",
    "Intended fix: look at git reflog, name the lost commit with a branch (git branch <name> main@{1}),",
    "merge that branch into main (a real merge, no conflicts), then git push, which fast-forwards origin without --force.",
    "Goals: both Tidy commits reachable from origin's main, Blaze's original commit still on origin's main (not rebased or copied),",
    "and no lost commits at the end (so cherry-picks alone leave the originals lost unless a branch keeps them).",
    "Steer away from force-pushing: that is the mistake this level is about, and it would push Blaze's work off origin.",
    "Good first nudges: git reflog shows where main has been; git log on a reflog entry shows what was there.",
  ].join("\n"),
  suggestions: ["git status", "git log --oneline", "git reflog", "git log --oneline main@{1}", "git branch", "git push"],
  outro: [
    say("tidy", "My price list! Both commits, right where they belong.", "celebrate"),
    say("blaze", "Okay. Maybe force-push is not a broom.", "guilty"),
    say("tidy", "Merge, then push. Every time. I'll write it on the sign.", "happy"),
    say("blaze", "In capitals?", "talking"),
    say("tidy", "No.", "talking"),
  ],
};
