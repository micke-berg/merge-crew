import { commitFile, fails, git, type Scenario } from "../scenario";

const P = "player";

const base = commitFile(P, "app.txt", "app\n", "Base");

export const worktrees: Scenario[] = [
  {
    name: "two robots commit on their own branches in their own worktrees",
    steps: [
      ...base,
      git(P, "worktree add /crew/blaze -b blaze"),
      git(P, "worktree add /crew/drift -b drift"),
      ...commitFile("blaze", "fast.txt", "zoom\n", "Blaze ships fast"),
      ...commitFile("drift", "dream.txt", "hmm\n", "Drift daydreams"),
      ...commitFile("blaze", "fast.txt", "zoom zoom\n", "Blaze ships again"),
      git(P, ["merge", "blaze"]),
      git(P, ["merge", "drift", "-m", "Merge drift"]),
    ],
  },
  {
    name: "a branch checked out in another worktree cannot be switched to or deleted",
    steps: [
      ...base,
      git(P, "worktree add /crew/blaze -b blaze"),
      fails(git(P, "switch blaze")),
      fails(git(P, "checkout blaze")),
      fails(git(P, "branch -d blaze")),
      fails(git("blaze", "switch main")),
      fails(git(P, "worktree add /crew/tidy main")),
      fails(git(P, "worktree add /crew/blaze -b other")),
    ],
  },
  {
    name: "worktree add on an existing branch, and a robot pushes its branch",
    steps: [
      ...base,
      git(P, "push -u origin main"),
      git(P, "branch drift"),
      git(P, "worktree add /crew/drift drift"),
      ...commitFile("drift", "d.txt", "d\n", "Drift work"),
      git("drift", "push -u origin drift"),
      git(P, "fetch"),
      git(P, ["merge", "origin/drift"]),
    ],
  },
  {
    name: "Blaze force-pushes over main and the player restores it",
    steps: [
      ...base,
      ...commitFile(P, "tidy.txt", "careful\n", "Tidy work one"),
      ...commitFile(P, "tidy.txt", "careful\nand tested\n", "Tidy work two"),
      git(P, "push -u origin main"),
      git(P, "worktree add /crew/blaze -b blaze HEAD~2"),
      ...commitFile("blaze", "blaze.txt", "yolo\n", "Blaze rewrite"),
      git("blaze", "push --force origin blaze:main"),
      git(P, "fetch"),
      git(P, ["merge", "origin/main", "-m", "Merge Blaze into main"]),
      git(P, "push"),
    ],
  },
  {
    name: "a robot resets its own branch without touching the player's worktree",
    steps: [
      ...base,
      git(P, "worktree add /crew/hoarder -b hoarder"),
      ...commitFile("hoarder", "pile.txt", "stuff\n", "Hoarder pile"),
      git("hoarder", "reset --hard HEAD~1"),
      git("hoarder", "reset --hard HEAD@{1}"),
      fails(git(P, "branch -f main hoarder")),
      git(P, ["merge", "hoarder"]),
    ],
  },
];
