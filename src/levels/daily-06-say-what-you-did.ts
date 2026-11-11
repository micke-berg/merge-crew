import type { Level } from "@/engine/types";
import { branch, fileInTipEquals, pointsAtMessage, remoteBranch } from "./goals";
import { git, say, write } from "./script";

const OPEN = "Open the café";
export const BAD = "asdf";
const HOURS_FILE = "Winter: open 10 to 4\n";

/*
 * A daily incident: played only at /daily, never listed in the acts. Checked against real git by
 * tests/oracle/levels.test.ts.
 *
 *   The newest commit on main, not pushed, has the message "asdf".
 *   Expected: git commit --amend -m "Add winter hours" (the same change, a new commit with a real message).
 *   Not accepted: a second commit on top, which leaves "asdf" in the history.
 */

export const level: Level = {
  id: "daily-06",
  act: 2,
  order: 106,
  title: "Say what you did",
  par: 1,
  learned: "git commit --amend replaces your newest commit with a corrected one. Only do it before you push: it makes a new commit.",
  brief: "Hoarder saved the winter hours for you with the message 'asdf'. It is not pushed yet. Give the commit a message someone can read.",
  mission: {
    situation: "The newest commit on your main holds the winter hours, and its message is 'asdf'. In a month nobody will know what it was. It has not been pushed.",
    job: "Replace the newest commit's message with one that says what the commit does. Keep it as one commit.",
    practise: ["git log --oneline", "git show --stat HEAD", "git commit --amend"],
  },
  crew: ["hoarder", "tidy"],
  setup: [
    write("player", "menu.txt", "Lemonade\nIced tea\n"),
    git("player", "add", "menu.txt"),
    git("player", "commit", "-m", OPEN),
    git("player", "push", "-u", "origin", "main"),
    write("player", "hours.txt", HOURS_FILE),
  ],
  intro: [
    say("hoarder", "I committed for you, lead! I was so nervous I just hit some keys for the message.", "scared", ["hours.txt"]),
    git("player", "add", "hours.txt"),
    git("player", "commit", "-m", BAD),
    say("tidy", "The message is 'asdf'. The change is fine. The message tells nobody anything.", "thinking"),
    say("tidy", "It is not pushed, so you can still replace that commit with a corrected one. One commit, a real message.", "talking"),
  ],
  goals: [
    {
      id: "renamed",
      description: "Replace the newest commit with one whose message says what it does",
      check: (state, queries) => {
        const tip = state.branches.main;
        const commit = tip ? state.commits[tip] : undefined;
        const base = state.remotes.origin?.branches.main;
        return (
          !!commit &&
          commit.message !== BAD &&
          commit.message.trim().length >= 5 &&
          commit.parents.length === 1 &&
          commit.parents[0] === base &&
          fileInTipEquals(branch("main"), "hours.txt", HOURS_FILE)(state, queries)
        );
      },
    },
    {
      id: "origin-untouched",
      description: "Origin's main stays as it is: only the unpushed commit changes",
      check: pointsAtMessage(remoteBranch("origin", "main"), OPEN),
    },
  ],
  suggestions: ["git status", "git log --oneline", "git show --stat HEAD"],
  outro: [
    say("tidy", "One commit, and its message says what it does.", "celebrate"),
    say("hoarder", "The old one is still in the grey down there. I can see it.", "surprised"),
    say("tidy", "Amend makes a new commit and leaves the old one behind. That is why you only amend what you have not pushed.", "talking"),
  ],
};
