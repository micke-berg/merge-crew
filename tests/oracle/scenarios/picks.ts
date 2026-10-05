// git cherry-pick and git revert: clean picks, ranges, conflicts with --continue, --skip and
// --abort, picks that turn out empty, and concluding with a plain commit.

import { commitFile, fails, git, stops, write, type Scenario } from "../scenario";

const P = "player";
const base = commitFile(P, "a.txt", "1\n2\n3\n", "Base");

/** feature: X (new file), F (edits line 2 of a.txt), Y (new file). main: M (edits line 2 too). */
const setup = [
  ...base,
  git(P, "switch -c feature"),
  ...commitFile(P, "x.txt", "x\n", "X"),
  ...commitFile(P, "a.txt", "1\nF\n3\n", "F"),
  ...commitFile(P, "y.txt", "y\n", "Y"),
  git(P, "switch main"),
  ...commitFile(P, "a.txt", "1\nM\n3\n", "M"),
];

export const picks: Scenario[] = [
  {
    name: "cherry-pick copies one commit onto the current branch",
    copiesCommits: true,
    steps: [...setup, git(P, "cherry-pick feature~2"), git(P, "cherry-pick feature")],
  },
  {
    name: "cherry-pick a range, stopping on a conflict, then continue",
    copiesCommits: true,
    steps: [
      ...setup,
      stops(git(P, "cherry-pick main..feature")),
      git(P, "status"),
      fails(git(P, "cherry-pick --continue")),
      fails(git(P, "cherry-pick feature")),
      write(P, "a.txt", "1\nM and F\n3\n"),
      git(P, "add a.txt"),
      git(P, "cherry-pick --continue"),
      fails(git(P, "cherry-pick --continue")),
    ],
  },
  {
    name: "cherry-pick --abort returns to where the picks started",
    copiesCommits: true,
    steps: [
      ...setup,
      stops(git(P, "cherry-pick feature~2 feature~1 feature")),
      git(P, "cherry-pick --abort"),
      fails(git(P, "cherry-pick --abort")),
    ],
  },
  {
    name: "cherry-pick --skip moves on to the next commit",
    copiesCommits: true,
    steps: [...setup, stops(git(P, "cherry-pick feature~1 feature")), git(P, "cherry-pick --skip")],
  },
  {
    name: "a conflicting cherry-pick concluded with git commit",
    copiesCommits: true,
    steps: [
      ...setup,
      stops(git(P, "cherry-pick feature~1")),
      fails(git(P, "commit --amend -m Nope")),
      write(P, "a.txt", "1\nresolved\n3\n"),
      git(P, "add a.txt"),
      git(P, "commit"),
    ],
  },
  {
    name: "cherry-pick of a change that is already there stops as empty",
    copiesCommits: true,
    steps: [
      ...setup,
      git(P, "cherry-pick feature~2"),
      stops(git(P, "cherry-pick feature~2")),
      fails(git(P, "cherry-pick --continue")),
      git(P, "cherry-pick --skip"),
    ],
  },
  {
    name: "cherry-pick refuses merges, bad revisions and local changes",
    steps: [
      ...setup,
      git(P, "switch feature"),
      stops(git(P, ["merge", "main", "-m", "Merge main"])),
      write(P, "a.txt", "1\nmerged\n3\n"),
      git(P, "add a.txt"),
      git(P, "commit"),
      git(P, "switch main"),
      fails(git(P, "cherry-pick feature")),
      fails(git(P, "cherry-pick nope")),
      fails(git(P, "cherry-pick")),
      write(P, "x.txt", "staged\n"),
      git(P, "add x.txt"),
      fails(git(P, "cherry-pick feature~3")),
      git(P, "reset --hard"),
      write(P, "x.txt", "untracked\n"),
      fails(git(P, "cherry-pick feature~3")),
    ],
  },
  {
    name: "revert undoes a commit with git's message",
    copiesCommits: true,
    steps: [
      ...setup,
      git(P, "revert HEAD"),
      git(P, "revert --no-edit HEAD"),
      git(P, "revert HEAD"),
      git(P, "log --oneline"),
    ],
  },
  {
    name: "revert stops on a conflict and continues",
    steps: [
      ...base,
      ...commitFile(P, "a.txt", "1\nTwo\n3\n", "Two"),
      ...commitFile(P, "a.txt", "1\nTwo again\n3\n", "Two again"),
      stops(git(P, "revert HEAD~1")),
      git(P, "status"),
      write(P, "a.txt", "1\n2\n3\n"),
      git(P, "add a.txt"),
      git(P, "revert --continue"),
    ],
  },
  {
    name: "revert --abort and revert concluded with git commit",
    steps: [
      ...base,
      ...commitFile(P, "a.txt", "1\nTwo\n3\n", "Two"),
      ...commitFile(P, "a.txt", "1\nTwo again\n3\n", "Two again"),
      stops(git(P, "revert HEAD~1")),
      git(P, "revert --abort"),
      stops(git(P, "revert HEAD~1")),
      write(P, "a.txt", "1\nfixed\n3\n"),
      git(P, "add a.txt"),
      git(P, "commit"),
      fails(git(P, "revert --continue")),
    ],
  },
  {
    name: "revert a range of commits",
    steps: [
      ...base,
      ...commitFile(P, "b.txt", "b\n", "Add b"),
      ...commitFile(P, "c.txt", "c\n", "Add c"),
      git(P, "revert HEAD~2..HEAD"),
    ],
  },
  {
    name: "reset --hard ends a stopped cherry-pick",
    copiesCommits: true,
    steps: [...setup, stops(git(P, "cherry-pick feature~1")), git(P, "reset --hard"), fails(git(P, "cherry-pick --continue"))],
  },
  {
    name: "a robot cherry-picks the player's commit in its own worktree",
    copiesCommits: true,
    steps: [
      ...base,
      git(P, "worktree add /crew/tidy"),
      ...commitFile(P, "fix.txt", "fix\n", "Player fix"),
      git("tidy", "cherry-pick main"),
      git("tidy", "revert HEAD"),
      git(P, "log --oneline tidy"),
    ],
  },
];
