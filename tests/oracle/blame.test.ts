// git blame has no effect on the repository, so the scenario comparison cannot check it. These tests
// build a few histories in real git and in the engine, then compare which commit (by message) each
// line of a file is blamed on. Commit messages in a history are unique, so a message names a commit.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { engine } from "@/engine";
import { blameLines } from "@/engine/commands/blame";
import type { RepoState } from "@/engine/types";
import { gitOut, runGit } from "./git-cli";

type Step = { git: string } | { write: string; content: string };
const g = (line: string): Step => ({ git: line });
const w = (file: string, content: string): Step => ({ write: file, content });

/** Quote-aware split, enough for the commands used here. */
function words(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
}

async function realBlame(steps: Step[], file: string): Promise<string[]> {
  const dir = realpathSync(await mkdtemp(join(tmpdir(), "merge-crew-blame-")));
  try {
    await gitOut(dir, ["init", "-q", "-b", "main"]);
    let tick = 0;
    for (const s of steps) {
      if ("write" in s) await writeFile(join(dir, s.write), s.content);
      else {
        const r = await runGit(dir, words(s.git).slice(1), { tick: ++tick });
        if (r.code !== 0 && !s.git.startsWith("git merge")) throw new Error(`${s.git}: ${r.stderr}`);
      }
    }
    const out = await gitOut(dir, ["blame", "--line-porcelain", "--", file]);
    return out
      .split("\n")
      .filter((l) => l.startsWith("summary "))
      .map((l) => l.slice("summary ".length));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function engineBlame(steps: Step[], file: string): string[] {
  let state: RepoState = engine.createRepo({ withOrigin: false });
  for (const s of steps) {
    if ("write" in s) {
      state = engine.edit(state, { kind: "write", actor: "player", path: s.write, content: s.content }).state;
    } else {
      const r = engine.run(state, { actor: "player", argv: words(s.git) });
      state = r.state;
    }
  }
  const oid = state.branches[state.worktrees.player.head.kind === "branch" ? state.worktrees.player.head.name : "main"];
  const owners = blameLines(state, oid, file);
  if (!owners) throw new Error("file not found in the engine");
  return owners.map((o) => state.commits[o].message);
}

const cases: { name: string; file: string; steps: Step[] }[] = [
  {
    name: "a file edited over three commits",
    file: "a.txt",
    steps: [
      w("a.txt", "one\ntwo\nthree\n"),
      g('git add a.txt'),
      g('git commit -m "First"'),
      w("a.txt", "one\nTWO\nthree\n"),
      g('git commit -am "Change two"'),
      w("a.txt", "one\nTWO\nthree\nfour\n"),
      g('git commit -am "Add four"'),
    ],
  },
  {
    name: "lines added in the middle and a line removed",
    file: "a.txt",
    steps: [
      w("a.txt", "a\nb\nc\nd\n"),
      g("git add a.txt"),
      g('git commit -m "Base"'),
      w("a.txt", "a\nx\nb\nd\n"),
      g('git commit -am "Insert x, drop c"'),
      w("a.txt", "a\nx\nb\nd\ny\ny2\n"),
      g('git commit -am "Append"'),
    ],
  },
  {
    name: "a branch merged back without a conflict",
    file: "a.txt",
    steps: [
      w("a.txt", "top\nmiddle\nbottom\n"),
      g("git add a.txt"),
      g('git commit -m "Base"'),
      g("git switch -c side"),
      w("a.txt", "top\nmiddle\nbottom\nside line\n"),
      g('git commit -am "Side adds a line"'),
      g("git switch main"),
      w("a.txt", "main top\nmiddle\nbottom\n"),
      g('git commit -am "Main edits top"'),
      g('git merge side -m "Merge side"'),
    ],
  },
  {
    name: "a conflict settled by hand",
    file: "a.txt",
    steps: [
      w("a.txt", "keep\nshared\n"),
      g("git add a.txt"),
      g('git commit -m "Base"'),
      g("git switch -c other"),
      w("a.txt", "keep\nother says\n"),
      g('git commit -am "Other edits shared"'),
      g("git switch main"),
      w("a.txt", "keep\nmain says\n"),
      g('git commit -am "Main edits shared"'),
      g('git merge other -m "Merge other"'),
      w("a.txt", "keep\nmain says\nother says\n"),
      g("git add a.txt"),
      g('git commit -m "Settle the conflict"'),
    ],
  },
  {
    name: "a line deleted and added back later",
    file: "a.txt",
    steps: [
      w("a.txt", "x\ny\nz\n"),
      g("git add a.txt"),
      g('git commit -m "Base"'),
      w("a.txt", "x\nz\n"),
      g('git commit -am "Remove y"'),
      w("a.txt", "x\ny\nz\n"),
      g('git commit -am "Put y back"'),
    ],
  },
];

describe("git blame against real git", () => {
  for (const c of cases) {
    it(c.name, async () => {
      const real = await realBlame(c.steps, c.file);
      expect(engineBlame(c.steps, c.file)).toEqual(real);
    });
  }
});
