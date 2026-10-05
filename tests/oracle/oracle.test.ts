// Real git is the referee: every scenario runs through the git CLI and through the engine, and the
// two snapshots must match. While the engine is unfinished, engine comparisons skip with a reason.

import { availableParallelism } from "node:os";
import { beforeAll, describe, expect, it } from "vitest";
import { diffOutcomes, diffSnapshots, formatDiff } from "./compare";
import { loadEngine, runEngine } from "./engine-run";
import { runRealGit, type RealGitResult } from "./real-git";
import type { Scenario } from "./scenario";
import { scenarios } from "./scenarios";
import type { RepoState } from "@/engine/types";
import { fromEngine, type Snapshot } from "./snapshot";

// Every scenario runs through real git once, several at a time, before the tests read the results.
const real = new Map<Scenario, RealGitResult | Error>();

beforeAll(async () => {
  const queue = [...scenarios];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      try {
        real.set(s, await runRealGit(s));
      } catch (e) {
        real.set(s, e as Error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(2, Math.min(8, availableParallelism())) }, worker));
}, 120_000);

function realResult(scenario: Scenario): RealGitResult {
  const r = real.get(scenario);
  if (!r) throw new Error(`no real git result for ${scenario.name}`);
  if (r instanceof Error) throw r;
  return r;
}

function checkSane(name: string, snap: Snapshot): string[] {
  const problems: string[] = [];
  const labels = new Set(Object.keys(snap.commits));
  const refs = [
    ...Object.values(snap.branches),
    ...Object.values(snap.remoteTracking),
    ...Object.values(snap.remotes).flatMap((r) => Object.values(r)),
    ...Object.values(snap.worktrees).flatMap((w) => [...w.headReflog, ...(w.head.startsWith("detached:") ? [w.head.slice(9)] : [])]),
    ...Object.values(snap.commits).flatMap((c) => c.parents),
  ];
  for (const r of refs) if (!labels.has(r)) problems.push(`${name}: ${r} is referenced but not in commits`);
  if (!snap.worktrees.player) problems.push(`${name}: no player worktree`);
  return problems;
}

const byName = (name: string) => {
  const s = scenarios.find((x) => x.name === name);
  if (!s) throw new Error(`no scenario named ${name}`);
  return s;
};

describe("oracle: real git self-test", () => {
  it("has at least 25 scenarios with unique names", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(25);
    expect(new Set(scenarios.map((s) => s.name)).size).toBe(scenarios.length);
  });

  it.for(scenarios.map((s) => [s.name, s] as const))("%s", ([, scenario]) => {
    const { records, snapshot } = realResult(scenario);
    const wrong = records
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.outcome !== (r.step.expect ?? "ok"))
      .map(({ r, i }) => `step ${i} ${JSON.stringify(r.step)}: expected ${r.step.expect ?? "ok"}, got ${r.outcome}\n${r.output}`);
    expect(wrong).toEqual([]);
    expect(checkSane(scenario.name, snapshot)).toEqual([]);
    // Labels come from unique messages, except where a scenario amends without editing the message.
    const tagged = Object.keys(snapshot.commits).filter((l) => l.includes("{tree:"));
    if (!scenario.name.includes("--no-edit")) expect(tagged).toEqual([]);
  });

  it("a conflicting merge records markers, conflict stages and the merge in progress", () => {
    const wt = realResult(byName("conflicting merge leaves markers in the working file")).snapshot.worktrees.player;
    expect(wt.inProgress).toBe("merge");
    expect(Object.keys(wt.conflicts)).toEqual(["a.txt"]);
    expect(wt.conflicts["a.txt"]).toEqual({
      base: "line 1\nline 2\nline 3\n",
      ours: "line 1\nmain says hi\nline 3\n",
      theirs: "line 1\nfeature says hi\nline 3\n",
    });
    expect(wt.working["a.txt"]).toBe("line 1\n<<<<<<< HEAD\nmain says hi\n=======\nfeature says hi\n>>>>>>> feature\nline 3\n");
    expect(wt.index["only-feature.txt"]).toBe("f\n");
    expect(wt.index["a.txt"]).toBeUndefined();
  });

  it("a pull conflict names the fetched commit by label in the markers", () => {
    const wt = realResult(byName("pull with a conflict stops in a merge")).snapshot.worktrees.player;
    expect(wt.inProgress).toBe("merge");
    expect(wt.working["a.txt"]).toContain(">>>>>>> <Second>\n");
  });

  it("a pull merge names the remote, not its folder", () => {
    const snap = realResult(byName("pull merges diverged history")).snapshot;
    expect(snap.branches.main).toBe("Merge branch 'main' of origin");
  });

  it("force push leaves the lost commit only in the reflog", () => {
    const snap = realResult(byName("force push loses the remote's commits")).snapshot;
    expect(snap.remotes.origin.main).toBe("Rewritten");
    expect(snap.remoteTracking["origin/main"]).toBe("Rewritten");
    expect(snap.worktrees.player.headReflog).toContain("Third");
    expect(snap.commits.Rewritten.parents).toEqual(["First"]);
  });

  it("linked worktrees get their own head, files and reflog", () => {
    const snap = realResult(byName("two robots commit on their own branches in their own worktrees")).snapshot;
    expect(Object.keys(snap.worktrees)).toEqual(["blaze", "drift", "player"]);
    expect(snap.worktrees.blaze.head).toBe("blaze");
    expect(snap.worktrees.blaze.working["fast.txt"]).toBe("zoom zoom\n");
    expect(snap.worktrees.blaze.headReflog.slice(-2)).toEqual(["Blaze ships fast", "Blaze ships again"]);
    expect(snap.commits["Blaze ships fast"].author).toBe("blaze");
  });
});

describe("oracle: engine matches real git", async () => {
  const engine = await loadEngine();

  it.for(scenarios.map((s) => [s.name, s] as const))("%s", ([name, scenario], ctx) => {
    if (typeof engine === "string") return ctx.skip(engine);
    const engineRun = runEngine(engine, scenario);
    if (engineRun.kind === "unsupported") return ctx.skip(`not supported yet: ${engineRun.reason}`);
    const realRun = realResult(scenario);
    const problems = [...diffOutcomes(realRun.records, engineRun.steps), ...diffSnapshots(realRun.snapshot, fromEngine(engineRun.state))];
    if (problems.length > 0) expect.fail(formatDiff(name, problems));
  });
});

describe("oracle: engine adapter and diff", () => {
  const oid = (n: number) => n.toString(16).padStart(40, "a");
  const tree = { "readme.md": "hello\n" };
  const entry = { oid: oid(1), previous: null, message: "commit (initial): Initial commit", time: 3 };
  const state: RepoState = {
    commits: { [oid(1)]: { oid: oid(1), parents: [], message: "Initial commit", tree, author: "player", time: 3 } },
    branches: { main: oid(1) },
    branchReflogs: { main: [entry] },
    upstreams: {},
    remoteTracking: {},
    remotes: { origin: { name: "origin", branches: {} } },
    worktrees: {
      player: {
        actor: "player",
        path: "/repo",
        head: { kind: "branch", name: "main" },
        index: tree,
        conflicts: {},
        workingTree: tree,
        headReflog: [entry],
        inProgress: null,
      },
    },
    stash: [],
    clock: 3,
  };

  it("a hand-built engine state matches real git for the first commit", () => {
    const realSnap = realResult(byName("first commit on an unborn main")).snapshot;
    expect(diffSnapshots(realSnap, fromEngine(state))).toEqual([]);
  });

  it("names the field and both sides when they differ", () => {
    const realSnap = realResult(byName("first commit on an unborn main")).snapshot;
    const changed: RepoState = {
      ...state,
      worktrees: { player: { ...state.worktrees.player, workingTree: { "readme.md": "changed\n" } } },
    };
    expect(diffSnapshots(realSnap, fromEngine(changed))).toEqual([
      'snapshot["worktrees"]["player"]["working"]["readme.md"]: real git "hello\\n", engine "changed\\n"',
    ]);
  });
});
