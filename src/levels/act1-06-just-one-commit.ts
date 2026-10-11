import type { Level } from "@/engine/types";
import {
  allOf,
  branch,
  commitWithMessageReachableFrom,
  fileInTipEquals,
  noCommitWithMessageReachableFrom,
} from "./goals";
import { git, say, write } from "./script";

const BASE = "Build the stand";
const CUPS = "Paint clouds on the cups";
const HOURS = "Add opening hours";

const SIGN = "LEMONADE\n";
const SIGN_WITH_HOURS = "LEMONADE\nOpen 9 to 5\n";

/*
 * Verified against real git 2.46:
 *
 *   Setup: main has one commit (sign.txt). Tidy's branch `ideas`, in Tidy's own worktree, has two
 *   commits on top of it: CUPS (cups.txt, not finished) and HOURS (sign.txt with opening hours, the
 *   newest commit).
 *
 *   git log --oneline ideas   HOURS, CUPS, BASE
 *   git cherry-pick ideas     copies HOURS onto main (sign.txt only, no conflict), the branch name
 *                             stands for its newest commit
 *
 *   Not accepted: git merge ideas (brings the unfinished cups along).
 */

export const level: Level = {
  id: "act1-06",
  act: 1,
  order: 6,
  title: "Just one commit",
  brief: "Tidy's branch has one useful commit and one unfinished one. Copy only the useful one onto main.",
  mission: {
    situation:
      "Tidy has a branch with two commits: cups with clouds on, which are not finished, and opening hours for the sign, which are.",
    job: "Copy just the opening hours onto main, and leave the cups behind. A merge would bring both. You will use this again in Act 2, when Drift's branch hides one good fix among half-finished work.",
    practise: ["git log --oneline ideas", "git cherry-pick"],
  },
  usedIn: "act2-05",
  crew: ["tidy"],
  setup: [
    write("player", "sign.txt", SIGN),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", BASE),
    git("player", "worktree", "add", "/crew/tidy", "-b", "ideas"),
    write("tidy", "cups.txt", "Cups with clouds on\n"),
    git("tidy", "add", "cups.txt"),
    git("tidy", "commit", "-m", CUPS),
    write("tidy", "sign.txt", SIGN_WITH_HOURS),
    git("tidy", "add", "sign.txt"),
    git("tidy", "commit", "-m", HOURS),
  ],
  intro: [
    say("tidy", "I did two things on my ideas branch. Clouds on the cups, which are not finished. And opening hours for the sign, which are.", "talking", ["sign.txt"]),
    say("tidy", "I want the opening hours on main today. A merge would bring the cups along too, and nobody wants half a cloud.", "thinking"),
    say("tidy", "git cherry-pick copies one commit onto the branch you are on. Give it a branch name and it takes that branch's newest commit.", "happy"),
  ],
  goals: [
    {
      id: "just-the-hours",
      description: "Copy just the opening hours onto main: git cherry-pick ideas (the unfinished cups stay off main)",
      check: allOf(
        commitWithMessageReachableFrom(branch("main"), HOURS),
        fileInTipEquals(branch("main"), "sign.txt", SIGN_WITH_HOURS),
        noCommitWithMessageReachableFrom(branch("main"), CUPS),
      ),
    },
  ],
  suggestions: ["git status", "git log --oneline ideas", "git log --oneline --all", "git cherry-pick ideas"],
  outro: [
    say("tidy", "The sign says open 9 to 5, and the cups are still on my branch where they belong.", "celebrate"),
    say("tidy", "Remember this one. Drift keeps a lot more on a branch than I do.", "happy"),
  ],
};
