import { commitFile, fails, git, write, type Scenario } from "../scenario";

const P = "player";

export const branches: Scenario[] = [
  {
    name: "create a branch, commit on it, delete it after merging",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      git(P, "branch feature"),
      git(P, "switch feature"),
      ...commitFile(P, "b.txt", "two\n", "Add b on feature"),
      git(P, "switch main"),
      git(P, "merge feature"),
      git(P, "branch -d feature"),
    ],
  },
  {
    name: "branch -d refuses an unmerged branch, -D deletes it",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      git(P, "switch -c feature"),
      ...commitFile(P, "b.txt", "two\n", "Unmerged work"),
      git(P, "switch main"),
      fails(git(P, "branch -d feature")),
      git(P, "branch -D feature"),
      fails(git(P, "branch -d feature")),
    ],
  },
  {
    name: "branch -f moves a branch, and cannot move the checked-out one",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "First"),
      ...commitFile(P, "a.txt", "two\n", "Second"),
      ...commitFile(P, "a.txt", "three\n", "Third"),
      git(P, "branch feature"),
      git(P, "branch -f feature HEAD~2"),
      fails(git(P, "branch -f main HEAD~1")),
      fails(git(P, "branch feature")),
    ],
  },
  {
    name: "rename a branch and the current branch",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      git(P, "branch old-name"),
      git(P, "branch -m old-name new-name"),
      git(P, "switch -c topic"),
      git(P, "branch -m renamed-topic"),
      fails(git(P, "branch -m new-name main")),
    ],
  },
  {
    name: "switch -c, checkout -b and switching back",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      git(P, "switch -c one"),
      ...commitFile(P, "one.txt", "1\n", "Work on one"),
      git(P, "checkout -b two main"),
      ...commitFile(P, "two.txt", "2\n", "Work on two"),
      git(P, "checkout one"),
      git(P, "switch main"),
      fails(git(P, "switch nowhere")),
      fails(git(P, "switch -c one")),
    ],
  },
  {
    name: "switch carries uncommitted changes, and refuses when they would be overwritten",
    steps: [
      ...commitFile(P, "a.txt", "base\n", "Add a"),
      git(P, "switch -c feature"),
      ...commitFile(P, "a.txt", "feature version\n", "Change a on feature"),
      git(P, "switch main"),
      write(P, "b.txt", "carried along\n"),
      git(P, "switch feature"),
      git(P, "switch main"),
      write(P, "a.txt", "dirty on main\n"),
      fails(git(P, "switch feature")),
    ],
  },
  {
    name: "detached HEAD: check out an old commit, commit there, switch away",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "First"),
      ...commitFile(P, "a.txt", "two\n", "Second"),
      git(P, "checkout HEAD~1"),
      ...commitFile(P, "b.txt", "detached work\n", "Detached commit"),
      git(P, "switch main"),
      git(P, "switch --detach HEAD~1"),
      git(P, "switch main"),
    ],
  },
  {
    name: "checkout -- path throws away working changes to one file",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      ...commitFile(P, "b.txt", "two\n", "Add b"),
      write(P, "a.txt", "scribbles\n"),
      write(P, "b.txt", "keep this\n"),
      git(P, "checkout -- a.txt"),
    ],
  },
];
