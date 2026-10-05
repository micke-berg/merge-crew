// Readable differences between two snapshots, and between the step outcomes of both sides.

import type { StepOutcome, StepRecord } from "./scenario";
import type { Snapshot } from "./snapshot";

function show(value: unknown): string {
  if (value === undefined) return "(missing)";
  const text = JSON.stringify(value);
  return text.length > 200 ? text.slice(0, 197) + "..." : text;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function diffValue(path: string, real: unknown, engine: unknown, out: string[]): void {
  if (isObject(real) && isObject(engine)) {
    const keys = new Set([...Object.keys(real), ...Object.keys(engine)]);
    for (const key of [...keys].sort()) diffValue(`${path}[${JSON.stringify(key)}]`, real[key], engine[key], out);
    return;
  }
  if (Array.isArray(real) && Array.isArray(engine)) {
    if (JSON.stringify(real) === JSON.stringify(engine)) return;
    out.push(`${path}: lists differ\n    real git: ${show(real)}\n    engine:   ${show(engine)}`);
    return;
  }
  if (JSON.stringify(real) === JSON.stringify(engine)) return;
  if (engine === undefined) out.push(`${path}: only in real git: ${show(real)}`);
  else if (real === undefined) out.push(`${path}: only in engine: ${show(engine)}`);
  else out.push(`${path}: real git ${show(real)}, engine ${show(engine)}`);
}

/** Every field where the snapshots differ. Empty when they match. */
export function diffSnapshots(real: Snapshot, engine: Snapshot): string[] {
  const out: string[] = [];
  diffValue("snapshot", real, engine, out);
  return out;
}

/** The engine's ok flag covers "ok" and "stopped" (a conflict that leaves an operation in progress). */
export function diffOutcomes(real: StepRecord[], engine: { ok: boolean; output: string }[]): string[] {
  const out: string[] = [];
  real.forEach((rec, i) => {
    const eng = engine[i];
    if (!eng) return;
    const expectOk = rec.outcome !== "error";
    if (expectOk !== eng.ok) {
      const what = "argv" in rec.step ? rec.step.argv.join(" ") : JSON.stringify(rec.step);
      out.push(
        `step ${i} (${rec.step.actor}: ${what}): real git ${describe(rec.outcome)}, engine ${eng.ok ? "succeeded" : "failed"}` +
          `\n    real git output: ${show(rec.output.trim())}\n    engine output:   ${show(eng.output.trim())}`,
      );
    }
  });
  return out;
}

function describe(outcome: StepOutcome): string {
  return outcome === "ok" ? "succeeded" : outcome === "stopped" ? "stopped with a conflict (engine should report ok)" : "failed";
}

export function formatDiff(name: string, lines: string[]): string {
  return `${name}: ${lines.length} difference(s)\n  ${lines.join("\n  ")}`;
}
