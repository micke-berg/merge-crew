// Tracing for hint calls, sent to Langfuse. Off unless both Langfuse keys are set; then
// src/instrumentation.ts registers the Langfuse span processor and Langfuse's AI SDK 7 integration,
// which records every model call as a generation with model, tokens and cost.
//
// One hint is one trace named "ask-tidy-hint": the root span holds what the player saw (input: the
// current goal and the player's recent commands; output: the hint shown). Under it sit the model
// call ("generate-hint") and the code check of the model's answer ("check-hint-safety", a guardrail).
// The hints of one play of a level share a session id, so a run reads as one session.

import "server-only";
import { startObservation } from "@langfuse/tracing";
import type { HintVerdict } from "./leak";

type Env = Record<string, string | undefined>;

/** Tracing is on only when both Langfuse keys are present. Without them nothing is sent anywhere. */
export function tracingEnabled(env: Env = process.env): boolean {
  return Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

/**
 * Which Langfuse environment traces belong to, so local and preview runs never mix with real players:
 * an explicit LANGFUSE_TRACING_ENVIRONMENT, else Vercel's own environment name, else "development".
 */
export function tracingEnvironment(env: Env = process.env): string {
  return env.LANGFUSE_TRACING_ENVIRONMENT || env.VERCEL_ENV || "development";
}

/** Stable observation names. Dashboards and evaluators match on these, so treat them like an API. */
export const TRACE_NAMES = {
  trace: "ask-tidy-hint",
  generation: "generate-hint",
  guardrail: "check-hint-safety",
} as const;

/** The span processor instrumentation.ts registered, kept on globalThis so route bundles can flush it. */
type Flushable = { forceFlush(): Promise<void> };
const PROCESSOR_KEY = Symbol.for("merge-crew.langfuse-processor");

export function rememberProcessor(p: Flushable): void {
  (globalThis as Record<symbol, unknown>)[PROCESSOR_KEY] = p;
}

/** Send buffered spans now. Serverless functions can be frozen right after the response. */
export async function flushTraces(): Promise<void> {
  const p = (globalThis as Record<symbol, unknown>)[PROCESSOR_KEY] as Flushable | undefined;
  await p?.forceFlush().catch(() => undefined);
}

/**
 * Record the code check of a model answer as a guardrail observation under the active trace. Without
 * a registered processor this creates a no-op span, so it is safe to call in tests and evals.
 */
export function recordSafetyCheck(raw: string, verdict: HintVerdict): void {
  startObservation(
    TRACE_NAMES.guardrail,
    {
      input: { hint: raw },
      output: verdict.ok ? { passed: true } : { passed: false, reason: verdict.reason },
      ...(verdict.ok ? {} : { level: "WARNING" as const, statusMessage: `Rejected: ${verdict.reason}` }),
    },
    { asType: "guardrail" },
  ).end();
}

/**
 * The AI SDK names its spans after the model ("invoke_agent anthropic/claude-haiku-4.5",
 * "chat anthropic/claude-haiku-4.5"). Langfuse's guidance is stable, verb-first names that never
 * contain the model: swapping models would otherwise break every filter and evaluator matching on
 * them. The model stays available as an attribute. Register this before the Langfuse span processor.
 */
type NamedSpan = { name: string; attributes: Record<string, unknown>; updateName(name: string): unknown };

export function stableSpanName(name: string, attributes: Record<string, unknown>): string | null {
  if (name.startsWith("invoke_agent ")) {
    const functionId = attributes["gen_ai.agent.name"];
    return typeof functionId === "string" && functionId ? functionId : "run-ai-call";
  }
  if (name.startsWith("chat ")) return "call-model";
  if (/^step \d+$/.test(name)) return "run-model-step";
  return null;
}

export class StableSpanNames {
  onStart(span: NamedSpan): void {
    const renamed = stableSpanName(span.name, span.attributes);
    if (renamed) span.updateName(renamed);
  }
  onEnd(): void {}
  async forceFlush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}
