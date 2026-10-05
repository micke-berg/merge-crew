import { commitFile, del, fails, git, write, type Scenario } from "../scenario";

const P = "player";

export const basics: Scenario[] = [
  {
    name: "first commit on an unborn main",
    steps: [write(P, "readme.md", "hello\n"), git(P, "add readme.md"), git(P, ["commit", "-m", "Initial commit"])],
  },
  {
    name: "staged, unstaged and untracked changes side by side",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      write(P, "a.txt", "one\ntwo\n"),
      git(P, "add a.txt"),
      write(P, "a.txt", "one\ntwo\nthree\n"),
      write(P, "b.txt", "new file\n"),
      git(P, "add b.txt"),
      write(P, "notes/todo.txt", "untracked\n"),
      git(P, "status"),
    ],
  },
  {
    name: "commit -am stages tracked changes but not untracked files",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      write(P, "a.txt", "changed\n"),
      write(P, "new.txt", "left alone\n"),
      git(P, ["commit", "-am", "Change a"]),
    ],
  },
  {
    name: "add a deletion and commit it",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      ...commitFile(P, "b.txt", "two\n", "Add b"),
      del(P, "a.txt"),
      git(P, "add a.txt"),
      git(P, ["commit", "-m", "Remove a"]),
    ],
  },
  {
    name: "add . picks up new, changed and deleted files",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      ...commitFile(P, "b.txt", "two\n", "Add b"),
      write(P, "a.txt", "one more\n"),
      del(P, "b.txt"),
      write(P, "src/c.txt", "three\n"),
      git(P, "add ."),
      git(P, ["commit", "-m", "Mixed changes"]),
    ],
  },
  {
    name: "amend with a new message",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      ...commitFile(P, "b.txt", "two\n", "Add b (typo)"),
      git(P, ["commit", "--amend", "-m", "Add b"]),
    ],
  },
  {
    name: "amend --no-edit with an extra file keeps the message",
    steps: [
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      ...commitFile(P, "b.txt", "two\n", "Add b"),
      write(P, "c.txt", "forgot this\n"),
      git(P, "add c.txt"),
      git(P, "commit --amend --no-edit"),
    ],
  },
  {
    name: "nothing to commit and missing paths are rejected",
    steps: [
      fails(git(P, ["commit", "-m", "Nothing yet"])),
      ...commitFile(P, "a.txt", "one\n", "Add a"),
      fails(git(P, ["commit", "-m", "Still nothing"])),
      fails(git(P, "add missing.txt")),
    ],
  },
];
