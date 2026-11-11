import type { Level } from "@/engine/types";
import { allOf, branch, noLostCommits, remoteBranch, sameTip, someBranchAheadOf } from "./goals";
import { git, say, write } from "./script";

const OPEN = "Open the café";
export const BANNER = "Add a sale banner";

/*
 * A daily incident: played only at /daily, never listed in the acts. Checked against real git by
 * tests/oracle/levels.test.ts.
 *
 *   Blaze used the player's keyboard and committed BANNER straight onto main. Nothing is pushed.
 *   Expected: git branch sale (a branch on the banner commit), git reset --hard HEAD~1 (main back to origin's).
 *   Also accepted: git switch -c sale, then moving main back with git branch -f main origin/main.
 *   Not accepted: resetting first without a branch, which leaves the banner on no branch.
 */

export const level: Level = {
  id: "daily-01",
  act: 2,
  order: 101,
  title: "The wrong line",
  par: 2,
  learned: "A commit on the wrong branch is not lost work. Put a new branch on it, then move the old branch back.",
  brief: "Blaze borrowed your keyboard and saved its sale banner straight onto your main. It is not pushed yet. Move it to a branch of its own.",
  mission: {
    situation: "Your main has one commit that origin's main does not: Blaze's sale banner, saved on the wrong branch. Nobody has reviewed it.",
    job: "Give the banner a branch of its own and put your main back in step with origin, without losing the commit.",
    practise: ["git log --oneline", "git branch", "git reset --hard"],
  },
  crew: ["blaze", "tidy"],
  setup: [
    write("player", "sign.txt", "CAFÉ COG\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", OPEN),
    git("player", "push", "-u", "origin", "main"),
  ],
  intro: [
    say("blaze", "Your keyboard was right there, lead, so I saved my sale banner for you. On main. Quickest way!", "happy"),
    write("player", "sign.txt", "CAFÉ COG\nSALE! SALE! SALE!\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", BANNER),
    say("tidy", "Main is one commit ahead of origin now, and nobody has read that banner. It belongs on a branch.", "thinking", ["sign.txt"]),
    say("tidy", "It is not pushed, so main can still move back. Keep the commit, lead. Just not there.", "talking"),
  ],
  goals: [
    {
      id: "moved",
      description: "Put the banner commit on a branch of its own, and main back in step with origin",
      check: allOf(sameTip(branch("main"), remoteBranch("origin", "main")), someBranchAheadOf("main")),
    },
    { id: "nothing-lost", description: "Nothing is lost: the banner commit stays reachable", check: noLostCommits() },
  ],
  suggestions: ["git status", "git log --oneline", "git branch"],
  outro: [
    say("tidy", "The banner has its own line now, and main matches origin again.", "celebrate"),
    say("blaze", "So I can still ship it? After someone reads it?", "talking"),
    say("tidy", "After someone reads it.", "happy"),
  ],
};
