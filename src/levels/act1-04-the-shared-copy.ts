import type { Level } from "@/engine/types";
import {
  allOf,
  branch,
  commitWithMessageReachableFrom,
  currentBranchIs,
  fileInTipEquals,
  originalCommitReachableFrom,
  remoteBranch,
  sameTip,
  workingTreeClean,
} from "./goals";
import { git, mood, pause, say, write } from "./script";

export const START = "Put the cafe online";
export const TIDY = "Open on Saturdays";

const HOURS_BEFORE = "Mon to Fri: 8 to 4\n";
export const HOURS_AFTER = "Mon to Fri: 8 to 4\nSat: 10 to 2\n";
const SIGN_BEFORE = "CAFE COG\n";
export const SIGN_AFTER = "CAFE COG\nNow open on Saturdays!\n";

/*
 * The situation, verified step by step against real git 2.46 (bare origin, linked worktree
 * /crew/tidy, pull.rebase=false):
 *
 *   Setup (instant):
 *     player:  START (hours.txt, sign.txt) on main, git push -u origin main
 *     tidy:    worktree /crew/tidy on branch tidy, commits TIDY (adds "Sat: 10 to 2" to hours.txt)
 *     player:  sign.txt edited to SIGN_AFTER, not staged (players cannot edit files outside conflicts)
 *
 *   Intro (scene):
 *     tidy:    git push origin tidy:main   (origin/main moves to TIDY)
 *   Worktrees share refs, so the push also moves the player's origin/main. Without a fetch,
 *   git status already says: "Your branch is behind 'origin/main' by 1 commit, and can be
 *   fast-forwarded." git log --oneline --all shows TIDY above START.
 *
 *   Expected solution (behind, then ahead, then in step):
 *     git status                     behind by 1, sign.txt modified
 *     git pull                       Fast-forward to TIDY (sign.txt is untouched, so the edit is kept)
 *     git add sign.txt
 *     git commit -m "Announce Saturdays on the sign"
 *                                    "Your branch is ahead of 'origin/main' by 1 commit."
 *     git push                       TIDY..new  main -> main (fast-forward)
 *                                    "Your branch is up to date with 'origin/main'."
 *
 *   Also verified and accepted:
 *     commit first, then git push    ! [rejected] main -> main (non-fast-forward), hint "use 'git pull'
 *                                    before pushing again". git status said "have diverged, 1 and 1".
 *     then git pull; git push        pull makes a merge commit (no conflict, different files), push
 *                                    fast-forwards origin.
 *     commit first, git pull --rebase, git push   (the player's commit is copied, Tidy's is not)
 *   Not accepted: commit first, then git push --force. Real git: "+ TIDY...new main -> main
 *   (forced update)", and TIDY drops off origin's main (only Tidy's branch still has it).
 */

export const level: Level = {
  id: "act1-04",
  act: 1,
  order: 4,
  title: "The shared copy",
  brief:
    "Origin is the shared copy the café's website is built from. Tidy pushed to it, so your copy is behind. Catch up, then push your own change.",
  mission: {
    situation:
      "Tidy opened Café Cog on Saturdays and pushed it to origin, the shared copy the café's website is built from. Your own copy doesn't have it yet, and the sign news in sign.txt isn't saved.",
    job: "Pull Tidy's change into your copy, save the sign in a commit, and push it, so origin and the website have both.",
    practise: ["git status", "git pull", "git commit", "git push", "git log --oneline --all"],
  },
  crew: ["tidy", "blaze"],
  setup: [
    write("player", "hours.txt", HOURS_BEFORE),
    write("player", "sign.txt", SIGN_BEFORE),
    git("player", "add", "hours.txt", "sign.txt"),
    git("player", "commit", "-m", START),
    git("player", "push", "-u", "origin", "main"),
    // Tidy works in its own worktree, its own copy of the files.
    git("player", "worktree", "add", "/crew/tidy", "-b", "tidy"),
    write("tidy", "hours.txt", HOURS_AFTER),
    git("tidy", "add", "hours.txt"),
    git("tidy", "commit", "-m", TIDY),
    // The change the player will save: an edited, unstaged file that Tidy's commit does not touch.
    write("player", "sign.txt", SIGN_AFTER),
  ],
  intro: [
    say("tidy", "Café Cog's website is built from origin, the shared copy of our project. The files here are your own copy.", "talking"),
    say("tidy", "We open on Saturdays now! It's saved in my copy. git push sends my commit to origin. Watch origin/main on the map.", "happy", ["hours.txt"]),
    pause(600),
    git("tidy", "push", "origin", "tidy:main"),
    pause(600),
    mood("tidy", "happy"),
    say("tidy", "Origin has my commit, your copy doesn't. You're behind. git status says so, and git pull brings it over.", "talking", ["hours.txt"]),
    say("tidy", "I also put the news on the sign in your copy, sign.txt. Commit it and you're ahead. git push sends it to origin.", "talking", ["sign.txt"]),
    say("tidy", "One rule. If push says no, origin has something you don't. Pull first, then push again.", "thinking"),
  ],
  goals: [
    {
      id: "pulled",
      description: "You're behind origin: git pull brings Tidy's Saturday hours into your copy",
      check: commitWithMessageReachableFrom(branch("main"), TIDY),
    },
    {
      id: "sign-saved",
      description: "Save sign.txt in a commit on main. Now you're ahead of origin",
      check: allOf(
        fileInTipEquals(branch("main"), "sign.txt", SIGN_AFTER),
        currentBranchIs("player", "main"),
        workingTreeClean("player"),
      ),
    },
    {
      id: "pushed",
      description: "git push, so origin has the sign and Tidy's hours, and your copy is in step with it",
      check: allOf(
        fileInTipEquals(remoteBranch("origin", "main"), "sign.txt", SIGN_AFTER),
        fileInTipEquals(remoteBranch("origin", "main"), "hours.txt", HOURS_AFTER),
        // A force-push before pulling knocks Tidy's commit off origin, so this fails.
        originalCommitReachableFrom(remoteBranch("origin", "main"), TIDY),
        sameTip(branch("main"), remoteBranch("origin", "main")),
      ),
    },
  ],
  suggestions: [
    "git status",
    "git log --oneline --all",
    "git pull",
    "git add sign.txt",
    'git commit -m "Announce Saturdays"',
    "git push",
  ],
  outro: [
    say("tidy", "Origin has the hours and the sign, so the website does too. Saturdays are official.", "celebrate"),
    say("blaze", "Pull first, then push? Every time? I'm a robot of action.", "talking"),
    say("tidy", "I know. That's what worries me.", "thinking"),
    say("tidy", "That's Act 1. You can save, branch, merge, pull and push. I'm a little proud. Don't tell Blaze.", "happy"),
  ],
};
