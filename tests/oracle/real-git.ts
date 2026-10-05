// Runs a scenario through the real git CLI in a fresh temporary folder:
//   <tmp>/origin.git   bare repository acting as origin
//   <tmp>/repo         the player's repository (main worktree), with origin added
//   <tmp>/crew/<name>  linked worktrees, from "/crew/<name>" paths in scenario commands
// Set ORACLE_KEEP=1 to keep the folder for debugging.

import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gitOut, runGit } from "./git-cli";
import { isGitStep, isWriteStep, type Scenario, type StepRecord } from "./scenario";
import { fromRealGit, stopSignature, type Snapshot } from "./snapshot";

export type RealGitResult = { records: StepRecord[]; snapshot: Snapshot; dir: string };

function mapPath(root: string, arg: string): string {
  if (arg === "/repo" || arg.startsWith("/repo/")) return join(root, arg.slice(1));
  if (arg.startsWith("/crew/")) return join(root, arg.slice(1));
  return arg;
}

function actorDir(root: string, actor: string): string {
  return actor === "player" ? join(root, "repo") : join(root, "crew", actor);
}

export async function runRealGit(scenario: Scenario): Promise<RealGitResult> {
  const root = realpathSync(await mkdtemp(join(tmpdir(), "merge-crew-oracle-")));
  try {
    const origin = join(root, "origin.git");
    const repo = join(root, "repo");
    mkdirSync(join(root, "crew"));
    await gitOut(root, ["init", "-q", "--bare", origin]);
    await gitOut(root, ["init", "-q", repo]);
    await gitOut(repo, ["remote", "add", "origin", origin]);

    const records: StepRecord[] = [];
    for (const [i, step] of scenario.steps.entries()) {
      const tick = i + 1;
      const cwd = actorDir(root, step.actor);
      if (isGitStep(step)) {
        const [cmd, ...args] = step.argv;
        if (cmd !== "git") throw new Error(`step ${i}: only git commands are supported, got ${cmd}`);
        // A nonzero exit counts as "stopped" only when the step itself left a stopped operation
        // behind. A command that fails while a merge is already open (commit with unresolved
        // conflicts) changes nothing and is an ordinary error.
        const before = await stopSignature(cwd);
        let r;
        try {
          r = await runGit(cwd, args.map((a) => mapPath(root, a)), { actor: step.actor, tick });
        } catch (e) {
          // Missing worktree folder for this actor.
          records.push({ step, outcome: "error", output: String(e) });
          continue;
        }
        const output = (r.stdout + r.stderr).split(root).join("");
        const after = r.code === 0 ? "" : await stopSignature(cwd);
        const outcome = r.code === 0 ? "ok" : after !== "" && after !== before ? "stopped" : "error";
        records.push({ step, outcome, output });
      } else if (isWriteStep(step)) {
        const file = join(cwd, step.write);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, step.content);
        records.push({ step, outcome: "ok", output: "" });
      } else {
        await rm(join(cwd, step.delete), { force: true });
        records.push({ step, outcome: "ok", output: "" });
      }
    }

    const snapshot = await fromRealGit({ repo, remotes: { origin } });
    return { records, snapshot, dir: root };
  } finally {
    if (!process.env.ORACLE_KEEP) await rm(root, { recursive: true, force: true });
  }
}
