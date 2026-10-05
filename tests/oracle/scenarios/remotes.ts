import { commitFile, fails, git, type Scenario } from "../scenario";

const P = "player";

const pushedTwo = [
  ...commitFile(P, "a.txt", "one\n", "First"),
  ...commitFile(P, "a.txt", "two\n", "Second"),
  git(P, "push -u origin main"),
];

export const remotes: Scenario[] = [
  {
    name: "push -u sets the upstream, later pushes and fetch",
    steps: [
      ...pushedTwo,
      ...commitFile(P, "b.txt", "b\n", "Third"),
      git(P, "push"),
      git(P, "fetch"),
      git(P, "switch -c feature"),
      fails(git(P, "push")),
      git(P, "push origin feature"),
    ],
  },
  {
    name: "pull fast-forwards to the remote",
    steps: [...pushedTwo, git(P, "reset --hard HEAD~1"), git(P, "pull")],
  },
  {
    name: "pull merges diverged history",
    steps: [
      ...pushedTwo,
      git(P, "reset --hard HEAD~1"),
      ...commitFile(P, "local.txt", "local\n", "Local work"),
      git(P, "pull"),
    ],
  },
  {
    name: "fetch then merge origin/main",
    steps: [
      ...pushedTwo,
      git(P, "reset --hard HEAD~1"),
      ...commitFile(P, "local.txt", "local\n", "Local work"),
      git(P, "fetch origin"),
      git(P, ["merge", "origin/main", "-m", "Merge origin/main"]),
      git(P, "push"),
    ],
  },
  {
    name: "push is rejected when the remote has commits we do not",
    steps: [
      ...pushedTwo,
      git(P, "reset --hard HEAD~1"),
      ...commitFile(P, "other.txt", "other\n", "Diverging work"),
      fails(git(P, "push")),
      fails(git(P, "push origin main")),
    ],
  },
  {
    name: "force push loses the remote's commits",
    steps: [
      ...pushedTwo,
      ...commitFile(P, "c.txt", "c\n", "Third"),
      git(P, "push"),
      git(P, "reset --hard HEAD~2"),
      ...commitFile(P, "rewrite.txt", "r\n", "Rewritten"),
      git(P, "push --force"),
    ],
  },
  {
    name: "force-with-lease rejects a stale lease and accepts a fresh one",
    steps: [
      ...pushedTwo,
      git(P, "reset --hard HEAD~1"),
      ...commitFile(P, "lease.txt", "l\n", "Lease work"),
      fails(git(P, "push --force-with-lease=main:HEAD~1 origin main")),
      git(P, "push --force-with-lease origin main"),
    ],
  },
  {
    name: "pull with a conflict stops in a merge",
    steps: [
      ...pushedTwo,
      git(P, "reset --hard HEAD~1"),
      ...commitFile(P, "a.txt", "local two\n", "Conflicting local"),
      { ...git(P, "pull"), expect: "stopped" },
    ],
  },
];
