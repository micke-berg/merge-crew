import type { Level } from "@/engine/types";
import { allOf, branch, commitWithMessageReachableFrom, noLostCommits } from "./goals";
import { git, point, say, write } from "./script";

const OPEN = "Open the café";
export const HOURS = "Add winter hours";
export const SOUP = "Add soup to the menu";

/*
 * A daily incident: played only at /daily, never listed in the acts. Checked against real git by
 * tests/oracle/levels.test.ts.
 *
 *   The player had two unpushed commits on main. Blaze reset the player's main to origin's "to clean up".
 *   Expected: git reflog (find the commit main was on), git reset --hard main@{1}.
 *   Also accepted: git merge main@{1} (a fast-forward), or HEAD@{1}.
 */

export const level: Level = {
  id: "daily-05",
  act: 2,
  order: 105,
  title: "Blaze cleaned up",
  par: 1,
  learned: "A reset moves a branch, it does not delete commits. The reflog shows where the branch was, and you can move it back.",
  brief: "You had two commits you had not pushed yet. Blaze saw that your main was 'ahead' and reset it to match origin. Get your commits back.",
  mission: {
    situation: "Your main is back at origin's commit, and your working files with it. The two commits you made this morning are on no branch any more.",
    job: "Find where main was before Blaze's reset and put it back there.",
    practise: ["git reflog", "git log --oneline main@{1}", "git reset --hard"],
  },
  crew: ["blaze", "tidy"],
  setup: [
    write("player", "menu.txt", "Lemonade\nIced tea\n"),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", OPEN),
    git("player", "push", "-u", "origin", "main"),
    write("player", "hours.txt", "Winter: open 10 to 4\n"),
    git("player", "add", "hours.txt"),
    git("player", "commit", "-m", HOURS),
    write("player", "menu.txt", "Lemonade\nIced tea\nSoup\n"),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", SOUP),
  ],
  intro: [
    say("blaze", "Lead! Your main was two commits ahead of origin. Looked messy. I fixed it!", "happy"),
    git("player", "reset", "--hard", "origin/main"),
    say("tidy", "Those were this morning's winter hours and the soup. They were not pushed anywhere, Blaze.", "scared"),
    point("tidy", "map", "No branch reaches these two now. Git still has them, for a while.", { mood: "thinking", focus: { lost: true } }),
    say("tidy", "Git keeps a diary of where main has been, lead. Put main back where it was.", "talking"),
  ],
  goals: [
    {
      id: "back",
      description: "Get your two commits back on main",
      check: allOf(commitWithMessageReachableFrom(branch("main"), HOURS), commitWithMessageReachableFrom(branch("main"), SOUP), noLostCommits()),
    },
  ],
  suggestions: ["git status", "git log --oneline", "git reflog", "git log --oneline main@{1}"],
  outro: [
    say("tidy", "Winter hours and soup, back on main. Push them before anything else happens.", "celebrate"),
    say("blaze", "So ahead of origin means work, not mess.", "guilty"),
    say("tidy", "It means work nobody else has yet. The most fragile kind.", "talking"),
  ],
};
