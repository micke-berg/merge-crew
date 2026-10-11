import type { Level } from "@/engine/types";
import {
  allOf,
  anyOf,
  branch,
  fileInTipHasLines,
  hasMergeCommit,
  mergeInProgress,
  workingTreeClean,
} from "./goals";
import { git, say, write } from "./script";

const BASE = "Write the sign";
const HOURS = "Add the opening hours";
const DRINKS = "Add the cold drinks line";

const HOURS_LINE = "Open 9 to 5";
const DRINKS_LINE = "Cold drinks only";

/*
 * Verified against real git 2.46:
 *
 *   Setup (nothing pushed): BASE (sign.txt = "LEMONADE"). Tidy's branch `slogan`, in Tidy's own
 *   worktree, appends DRINKS_LINE (DRINKS). main appends HOURS_LINE (HOURS). Both added a line at the
 *   end of sign.txt, so merging clashes.
 *
 *   git merge slogan    CONFLICT (content): Merge conflict in sign.txt
 *                       sign.txt: <<<<<<< HEAD / HOURS_LINE / ======= / DRINKS_LINE / >>>>>>> slogan
 *   (conflict editor)   keep both lines, in either order
 *   git add sign.txt
 *   git commit          concludes the merge with "Merge branch 'slogan'"
 *
 *   Not accepted: keeping only one line, or committing with the conflict markers still in the file.
 */

export const level: Level = {
  id: "act1-10",
  act: 1,
  order: 10,
  title: "Two edits, one line",
  brief: "You and Tidy both added a line to the sign. Merge Tidy's branch, settle the clash and keep both lines.",
  mission: {
    situation:
      "You added the opening hours to sign.txt and Tidy added a cold drinks line, both at the end of the file. Git cannot know which should come first.",
    job: "Merge Tidy's branch, let git stop on the conflict, choose to keep both lines, then finish the merge. You will do this again in Act 2, when Drift's branch clashes with main.",
    practise: ["git merge", "git add", "git commit"],
  },
  usedIn: "act2-02",
  crew: ["tidy"],
  setup: [
    write("player", "sign.txt", "LEMONADE\n"),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", BASE),
    git("player", "worktree", "add", "/crew/tidy", "-b", "slogan"),
    write("tidy", "sign.txt", `LEMONADE\n${DRINKS_LINE}\n`),
    git("tidy", "add", "sign.txt"),
    git("tidy", "commit", "-m", DRINKS),
    write("player", "sign.txt", `LEMONADE\n${HOURS_LINE}\n`),
    git("player", "add", "sign.txt"),
    git("player", "commit", "-m", HOURS),
  ],
  intro: [
    say("tidy", "You added the opening hours to sign.txt. I added a cold drinks line. We both wrote at the end of the file.", "talking", ["sign.txt"]),
    say("tidy", "Merge my branch and git will stop. When two people changed the same place, git does not guess. That is a conflict, and it is normal.", "thinking"),
    say("tidy", "Open the file from the Files panel and choose what stays. In the file, HEAD means your side, the branch you are on.", "happy"),
    say("tidy", "Then tell git the file is settled with git add, and finish with git commit.", "talking"),
  ],
  goals: [
    {
      id: "merge-started",
      description: "Merge Tidy's branch: git merge slogan (git will stop on a conflict)",
      check: anyOf(mergeInProgress("player"), hasMergeCommit(branch("main"))),
    },
    {
      id: "both-lines-kept",
      description: "Fix sign.txt so both lines stay, then git add sign.txt and git commit",
      check: allOf(
        hasMergeCommit(branch("main")),
        fileInTipHasLines(branch("main"), "sign.txt", [HOURS_LINE, DRINKS_LINE]),
        workingTreeClean("player"),
      ),
    },
  ],
  suggestions: ["git status", "git merge slogan", "git add sign.txt", "git commit", "git merge --abort"],
  outro: [
    say("tidy", "Both lines are on the sign and the merge is saved. Nobody lost a line.", "celebrate"),
    say("tidy", "A conflict is just git asking you to decide. Drift will give you a bigger one in Act 2.", "happy"),
  ],
};
