// Runs a scenario through the engine. The engine is imported lazily so the oracle suite stays
// runnable while src/engine/ is still being built.

import type { Engine, RepoState } from "@/engine/types";
import { isGitStep, isWriteStep, type Scenario } from "./scenario";

export type EngineRun =
  | { kind: "ran"; state: RepoState; steps: { ok: boolean; output: string }[] }
  | { kind: "unsupported"; reason: string };

const UNSUPPORTED = /not (yet )?(supported|implemented)/i;

/** The Engine from "@/engine", or a reason why it is not available yet. */
export async function loadEngine(): Promise<Engine | string> {
  let mod: Record<string, unknown>;
  try {
    // A variable specifier keeps typecheck green until src/engine/index.ts exists. Vitest still
    // applies the "@" alias at runtime.
    const specifier = "@/engine";
    mod = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
  } catch (e) {
    return `engine not importable yet: ${(e as Error).message.split("\n")[0]}`;
  }
  const candidates = [mod.engine, mod.default, mod];
  for (const c of candidates) {
    const e = c as Partial<Engine> | undefined;
    if (e && typeof e.createRepo === "function" && typeof e.run === "function" && typeof e.edit === "function") {
      return e as Engine;
    }
  }
  return `"@/engine" has no createRepo/run/edit export yet (exports: ${Object.keys(mod).join(", ") || "none"})`;
}

export function runEngine(engine: Engine, scenario: Scenario): EngineRun {
  let state: RepoState;
  try {
    state = engine.createRepo();
  } catch (e) {
    if (UNSUPPORTED.test(String(e))) return { kind: "unsupported", reason: `createRepo: ${String(e)}` };
    throw e;
  }
  const steps: { ok: boolean; output: string }[] = [];
  for (const [i, step] of scenario.steps.entries()) {
    const label = isGitStep(step) ? step.argv.join(" ") : isWriteStep(step) ? `write ${step.write}` : `delete ${step.delete}`;
    let result;
    try {
      result = isGitStep(step)
        ? engine.run(state, { actor: step.actor, argv: step.argv })
        : engine.edit(
            state,
            isWriteStep(step)
              ? { kind: "write", actor: step.actor, path: step.write, content: step.content }
              : { kind: "delete", actor: step.actor, path: step.delete },
          );
    } catch (e) {
      if (UNSUPPORTED.test(String(e))) return { kind: "unsupported", reason: `step ${i} (${label}): ${String(e)}` };
      throw new Error(`engine threw on step ${i} (${step.actor}: ${label}): ${String(e)}`, { cause: e });
    }
    const output = result.output.map((l) => `${l.kind}: ${l.text}`).join("\n");
    if (!result.ok && result.output.some((l) => UNSUPPORTED.test(l.text))) {
      return { kind: "unsupported", reason: `step ${i} (${label}): ${output}` };
    }
    steps.push({ ok: result.ok, output });
    state = result.state;
  }
  return { kind: "ran", state, steps };
}
