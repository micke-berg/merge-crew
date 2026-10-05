import { commitFile, del, fails, git, stops, write, type Scenario } from "../scenario";

const P = "player";

const base = commitFile(P, "a.txt", "line 1\nline 2\nline 3\n", "Base");

export const merges: Scenario[] = [
  {
    name: "fast-forward merge",
    steps: [
      ...base,
      git(P, "switch -c feature"),
      ...commitFile(P, "b.txt", "b\n", "Feature work"),
      git(P, "switch main"),
      git(P, "merge feature"),
      git(P, "merge feature"),
    ],
  },
  {
    name: "merge --no-ff makes a merge commit even when a fast-forward is possible",
    steps: [
      ...base,
      git(P, "switch -c feature"),
      ...commitFile(P, "b.txt", "b\n", "Feature work"),
      git(P, "switch main"),
      git(P, ["merge", "--no-ff", "feature", "-m", "Merge feature"]),
    ],
  },
  {
    name: "clean three-way merge",
    steps: [
      ...base,
      git(P, "switch -c feature"),
      ...commitFile(P, "a.txt", "line 1 feature\nline 2\nline 3\n", "Change top"),
      git(P, "switch main"),
      ...commitFile(P, "a.txt", "line 1\nline 2\nline 3 main\n", "Change bottom"),
      ...commitFile(P, "c.txt", "c\n", "Add c"),
      git(P, ["merge", "feature", "-m", "Merge feature"]),
    ],
  },
  {
    name: "conflicting merge leaves markers in the working file",
    steps: [
      ...base,
      git(P, "switch -c feature"),
      ...commitFile(P, "a.txt", "line 1\nfeature says hi\nline 3\n", "Feature edit"),
      ...commitFile(P, "only-feature.txt", "f\n", "Feature file"),
      git(P, "switch main"),
      ...commitFile(P, "a.txt", "line 1\nmain says hi\nline 3\n", "Main edit"),
      stops(git(P, ["merge", "feature", "-m", "Merge feature"])),
    ],
  },
  {
    name: "resolve a conflict and commit the merge",
    steps: [
      ...base,
      git(P, "switch -c feature"),
      ...commitFile(P, "a.txt", "line 1\nfeature\nline 3\n", "Feature edit"),
      git(P, "switch main"),
      ...commitFile(P, "a.txt", "line 1\nmain\nline 3\n", "Main edit"),
      stops(git(P, ["merge", "feature", "-m", "Merge feature"])),
      fails(git(P, ["commit", "-m", "Too early"])),
      write(P, "a.txt", "line 1\nmain and feature\nline 3\n"),
      git(P, "add a.txt"),
      git(P, ["commit", "-m", "Merge feature, resolved"]),
    ],
  },
  {
    name: "merge --abort puts everything back",
    steps: [
      ...base,
      git(P, "switch -c feature"),
      ...commitFile(P, "a.txt", "line 1\nfeature\nline 3\n", "Feature edit"),
      git(P, "switch main"),
      ...commitFile(P, "a.txt", "line 1\nmain\nline 3\n", "Main edit"),
      stops(git(P, ["merge", "feature", "-m", "Merge feature"])),
      git(P, "merge --abort"),
    ],
  },
  {
    name: "conflict where one side deleted the file",
    steps: [
      ...base,
      git(P, "switch -c feature"),
      del(P, "a.txt"),
      git(P, "add a.txt"),
      git(P, ["commit", "-m", "Delete a"]),
      git(P, "switch main"),
      ...commitFile(P, "a.txt", "line 1\nedited\nline 3\n", "Edit a"),
      stops(git(P, ["merge", "feature", "-m", "Merge feature"])),
    ],
  },
];
