// Tracing for hint calls. Off unless Langfuse keys are set; then src/instrumentation.ts registers the
// Langfuse span processor, and this file turns AI SDK telemetry events into Langfuse observations.
//
// The AI SDK (v7) emits telemetry through integrations. Its ready-made OpenTelemetry integration
// lives in a separate package this project does not install, so this is a small one of our own on
// top of @langfuse/tracing: one "generation" per model call, nested under the route's hint span.

import "server-only";
import type { Telemetry } from "ai";
import { startObservation, type LangfuseGeneration } from "@langfuse/tracing";

/** Tracing is on only when both Langfuse keys are present. Without them nothing is sent anywhere. */
export function tracingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

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

/** AI SDK telemetry integration: each language model call becomes a Langfuse generation. */
export function langfuseGenerations(metadata: Record<string, unknown>): Telemetry {
  const open = new Map<string, LangfuseGeneration>();
  return {
    onLanguageModelCallStart(event) {
      open.set(
        event.callId,
        startObservation(
          "hint-model-call",
          {
            model: event.modelId,
            input: { instructions: event.instructions, messages: event.messages },
            modelParameters: {
              ...(event.maxOutputTokens !== undefined ? { maxOutputTokens: event.maxOutputTokens } : {}),
              ...(event.temperature !== undefined ? { temperature: event.temperature } : {}),
            },
            metadata: { ...metadata, provider: event.provider },
          },
          { asType: "generation" },
        ),
      );
    },
    onLanguageModelCallEnd(event) {
      const gen = open.get(event.callId);
      if (!gen) return;
      open.delete(event.callId);
      const text = event.content.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
      gen
        .update({
          model: event.modelId,
          output: text,
          usageDetails: {
            input: event.usage.inputTokens ?? 0,
            output: event.usage.outputTokens ?? 0,
            total: (event.usage.inputTokens ?? 0) + (event.usage.outputTokens ?? 0),
          },
          metadata: { finishReason: event.finishReason },
        })
        .end();
    },
    onError(error) {
      for (const gen of open.values()) {
        gen.update({ level: "ERROR", statusMessage: error instanceof Error ? error.message : String(error) }).end();
      }
      open.clear();
    },
  };
}
