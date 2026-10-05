import { commitFile, git, write, type Scenario } from "../scenario";

const P = "player";

const threeCommits = [
  ...commitFile(P, "a.txt", "one\n", "First"),
  ...commitFile(P, "a.txt", "two\n", "Second"),
  ...commitFile(P, "b.txt", "bee\n", "Third"),
];

export const history: Scenario[] = [
  {
    name: "restore a working file and unstage with restore --staged",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      write(P, "a.txt", "oops\n"),
      git(P, "restore a.txt"),
      write(P, "a.txt", "staged change\n"),
      write(P, "new.txt", "new\n"),
      git(P, "add a.txt new.txt"),
      git(P, "restore --staged a.txt"),
      git(P, "restore --staged new.txt"),
    ],
  },
  {
    name: "reset --soft keeps the changes staged",
    steps: [...threeCommits, git(P, "reset --soft HEAD~1")],
  },
  {
    name: "reset --mixed unstages the changes",
    steps: [...threeCommits, write(P, "a.txt", "dirty\n"), git(P, "reset HEAD~2")],
  },
  {
    name: "reset --hard throws away commits and changes",
    steps: [...threeCommits, write(P, "a.txt", "dirty\n"), write(P, "untracked.txt", "stays\n"), git(P, "reset --hard HEAD~2")],
  },
  {
    name: "reset --hard to HEAD@{1} undoes a bad reset",
    steps: [...threeCommits, git(P, "reset --hard HEAD~2"), git(P, "reset --hard HEAD@{1}")],
  },
  {
    name: "recover a lost commit into a branch through the reflog",
    steps: [
      ...threeCommits,
      git(P, "reset --hard HEAD~1"),
      ...commitFile(P, "c.txt", "sea\n", "Fourth"),
      git(P, "branch rescue HEAD@{2}"),
      git(P, ["merge", "--no-ff", "rescue", "-m", "Merge rescued work"]),
    ],
  },
  {
    name: "recover a lost commit through the branch reflog main@{1}",
    steps: [...threeCommits, git(P, "reset --hard HEAD~2"), git(P, "switch -c saved main@{1}")],
  },
  {
    name: "recover a commit made on a detached HEAD",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Base"),
      git(P, "switch --detach"),
      ...commitFile(P, "lost.txt", "precious\n", "Detached work"),
      git(P, "switch main"),
      git(P, "branch found HEAD@{1}"),
    ],
  },
];
